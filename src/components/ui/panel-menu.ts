import {
  CapsuleGeometry,
  CylinderGeometry,
  Grabbed,
  Hovered,
  InputComponent,
  Mesh,
  MeshBasicMaterial,
  Pressed,
  RayInteractable,
  Vector3,
  VisibilityState,
  type Entity,
  type Object3D,
  type UIKitMLAsset,
} from '@iwsdk/core';
import type { ExperienceContext } from '../../core/xr/experience.js';
import { makeManipulable } from '../interaction/manipulable.js';
import { createProximityState } from '../interaction/triggers.js';
import { requireElement } from './controls.js';
import { summonPose, yawToward, type SummonOptions } from './panel-placement.js';

/**
 * Standard XR menu behaviour for a placed UIKitML panel:
 * - Move: grab the bar under the panel (ray / pinch / mouse); the panel follows and keeps facing you.
 * - Hide / show: left controller Menu (≡) or Y button, touching the wrist button with the other
 *   index finger (or pointing + pinching at it), or a keyboard key.
 * - When shown again, the panel appears in front of you at a comfortable distance.
 */
export type PanelMenuOptions = SummonOptions & {
  /** Scene node id of the placed panel. */
  nodeId: string;
  /** KeyboardEvent.code that toggles the menu on desktop. */
  key?: string;
  /** Gap between panel bottom edge and the grab bar, metres. */
  barGap?: number;
  /** Id of the panel's root UIKit element (hidden with display: none). */
  rootElementId?: string;
  /** Own toggle inputs (key, Menu/Y button, wrist button). Off for secondary windows. */
  inputs?: boolean;
  /** Re-place in front of the viewer when shown in XR. */
  summonOnShow?: boolean;
  /** Called whenever the window is shown or hidden (e.g. to toggle a window group). */
  onVisibilityChange?: (visible: boolean) => void;
};

export type PanelMenu = {
  readonly visible: boolean;
  show(): void;
  hide(): void;
  toggle(): void;
  update(): void;
  dispose(): void;
};

const setParentLocal = (object: Object3D, worldPosition: Vector3) => {
  object.position.copy(worldPosition);
  object.parent?.worldToLocal(object.position);
};

export const createPanelMenu = (ctx: ExperienceContext, options: PanelMenuOptions): PanelMenu => {
  const { world, theme, haptics } = ctx;
  const { nodeId, key = 'KeyM', barGap = 0.03, rootElementId = 'panel', inputs = true, summonOnShow = true, onVisibilityChange } = options;
  const panelEntity: Entity = world.requireSceneEntity(nodeId);
  const panel = panelEntity.object3D!;
  // Hide through UIKit's own layout state: toggling Object3D.visible is not observed by UIKit's
  // renderer, so a panel hidden that way never comes back.
  const panelRoot = requireElement(world.requireSceneObject<UIKitMLAsset>(nodeId), rootElementId);

  // Grab bar: pill below the panel, like Quest system windows. Its offset follows the root
  // element's live layout height (tabs change it), not a one-off bounding box.
  const UIKIT_PIXEL_SIZE = 0.01; // metres per UIKit unit (uikit default)
  const rootSize = (panelRoot as unknown as { size?: { value?: [number, number] } }).size;
  const panelScale = new Vector3();
  const barOffsetY = () => {
    const height = rootSize?.value?.[1] ?? 60;
    panel.getWorldScale(panelScale);
    return -(height * UIKIT_PIXEL_SIZE * panelScale.y) / 2 - barGap;
  };

  const barMaterial = new MeshBasicMaterial({ color: theme.colors.primary, transparent: true, opacity: 0.45 });
  const bar = new Mesh(new CapsuleGeometry(0.009, 0.11, 4, 12), barMaterial);
  bar.rotation.z = Math.PI / 2;
  bar.name = `${nodeId}-grab-bar`;
  const barEntity = world.createTransformEntity(bar);
  makeManipulable(barEntity, { grab: 'distance', rotate: false, scale: false });

  // Wrist button for hand tracking (left hand), pressed with the other hand's ray or pinch.
  const wristMaterial = new MeshBasicMaterial({ color: theme.colors.secondary, transparent: true, opacity: 0.85 });
  const wrist = new Mesh(new CylinderGeometry(0.016, 0.016, 0.006, 24), wristMaterial);
  wrist.name = `${nodeId}-wrist-toggle`;
  wrist.position.set(0, 0.035, 0.07);
  const wristEntity = world.createTransformEntity(wrist, { parent: world.playerSpaceEntities.gripSpaces.left });
  wristEntity.addComponent(RayInteractable);

  const fingertip = new Vector3();
  const wristWorld = new Vector3();
  const wristTouch = createProximityState({ radius: 0.025, hysteresis: 0.02 });
  const head = new Vector3();
  const forward = new Vector3();
  const panelWorld = new Vector3();
  const barWorld = new Vector3();
  let visible = true;
  let wristWasPressed = false;
  let barWasGrabbed = false;

  const placeBarUnderPanel = () => {
    panel.getWorldPosition(barWorld);
    barWorld.y += barOffsetY();
    setParentLocal(bar, barWorld);
    bar.rotation.set(0, panel.rotation.y, Math.PI / 2, 'YXZ');
  };

  const facePanelToHead = () => {
    world.camera.getWorldPosition(head);
    panel.getWorldPosition(panelWorld);
    panel.rotation.set(0, yawToward([panelWorld.x, 0, panelWorld.z], [head.x, 0, head.z]), 0);
  };

  const summon = () => {
    world.camera.getWorldPosition(head);
    world.camera.getWorldDirection(forward);
    const pose = summonPose({ position: [head.x, head.y, head.z], forward: [forward.x, forward.y, forward.z] }, options);
    setParentLocal(panel, panelWorld.set(...pose.position));
    panel.rotation.set(0, pose.yaw, 0);
  };

  const setInteractive = (entity: Entity, on: boolean) => {
    if (on && !entity.hasComponent(RayInteractable)) entity.addComponent(RayInteractable);
    if (!on && entity.hasComponent(RayInteractable)) entity.removeComponent(RayInteractable);
  };

  const apply = () => {
    panelRoot.setProperties({ display: visible ? 'flex' : 'none' });
    bar.visible = visible;
    setInteractive(panelEntity, visible);
    setInteractive(barEntity, visible);
  };

  const menu: PanelMenu = {
    get visible() {
      return visible;
    },
    show() {
      if (visible) return;
      visible = true;
      if (summonOnShow && world.visibilityState.peek() !== VisibilityState.NonImmersive) summon();
      placeBarUnderPanel();
      apply();
      onVisibilityChange?.(true);
    },
    hide() {
      if (!visible) return;
      visible = false;
      apply();
      onVisibilityChange?.(false);
    },
    toggle() {
      if (visible) menu.hide();
      else menu.show();
    },
    update() {
      const immersive = world.visibilityState.peek() !== VisibilityState.NonImmersive;

      // Toggle inputs: keyboard, left controller menu button, wrist button (hands only).
      if (!inputs) {
        wrist.visible = false;
        setInteractive(wristEntity, false);
      }
      if (inputs && world.input.keyboard.getKeyDown(key)) menu.toggle();
      const left = inputs ? world.input.xr.gamepads.left : undefined;
      if (left?.getButtonDown(InputComponent.Menu) || left?.getButtonDown(InputComponent.Y_Button)) {
        menu.toggle();
        haptics.play('left', 'click');
      }
      const handsActive = inputs && immersive && world.input.xr.isPrimary('hand', 'left');
      wrist.visible = handsActive;
      setInteractive(wristEntity, handsActive);
      // Wrist button: touch it with the right index fingertip, or point at it and pinch.
      let touched = false;
      if (handsActive) {
        world.player.indexTipSpaces.right.getWorldPosition(fingertip);
        wrist.getWorldPosition(wristWorld);
        touched = wristTouch.update(fingertip.distanceTo(wristWorld)) === 'enter';
      }
      const wristPressed = handsActive && wristEntity.hasComponent(Pressed);
      if (touched || (wristPressed && !wristWasPressed)) {
        menu.toggle();
        ctx.sounds.play('click');
      }
      wristWasPressed = wristPressed;
      wristMaterial.opacity = wristEntity.hasComponent(Hovered) ? 1 : 0.85;

      if (!visible) return;

      // Move: the panel follows the grabbed bar and keeps facing the viewer.
      const grabbed = barEntity.hasComponent(Grabbed);
      if (grabbed) {
        bar.getWorldPosition(barWorld);
        barWorld.y -= barOffsetY();
        setParentLocal(panel, barWorld);
        facePanelToHead();
        bar.rotation.set(0, panel.rotation.y, Math.PI / 2, 'YXZ');
      } else {
        placeBarUnderPanel();
      }
      if (grabbed !== barWasGrabbed && !grabbed) facePanelToHead();
      barWasGrabbed = grabbed;
      barMaterial.opacity = grabbed ? 0.95 : barEntity.hasComponent(Hovered) ? 0.8 : 0.45;
    },
    dispose() {
      barEntity.dispose();
      wristEntity.dispose();
      barMaterial.dispose();
      wristMaterial.dispose();
    },
  };

  placeBarUnderPanel();
  apply();
  return menu;
};
