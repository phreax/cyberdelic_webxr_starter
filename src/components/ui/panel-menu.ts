import {
  Box3,
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
} from '@iwsdk/core';
import type { ExperienceContext } from '../../core/xr/experience.js';
import { makeManipulable } from '../interaction/manipulable.js';
import { summonPose, yawToward, type SummonOptions } from './panel-placement.js';

/**
 * Standard XR menu behaviour for a placed UIKitML panel:
 * - Move: grab the bar under the panel (ray / pinch / mouse); the panel follows and keeps facing you.
 * - Hide / show: left controller Menu (≡) button, a wrist button when using hands, or a keyboard key.
 * - When shown again, the panel appears in front of you at a comfortable distance.
 */
export type PanelMenuOptions = SummonOptions & {
  /** Scene node id of the placed panel. */
  nodeId: string;
  /** KeyboardEvent.code that toggles the menu on desktop. */
  key?: string;
  /** Gap between panel bottom edge and the grab bar, metres. */
  barGap?: number;
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
  const { nodeId, key = 'KeyM', barGap = 0.03 } = options;
  const panelEntity: Entity = world.requireSceneEntity(nodeId);
  const panel = panelEntity.object3D!;

  // Grab bar: pill below the panel, like Quest system windows.
  panel.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(panel);
  const panelCenter = bounds.isEmpty() ? panel.getWorldPosition(new Vector3()) : bounds.getCenter(new Vector3());
  const halfHeight = bounds.isEmpty() ? 0.3 : (bounds.max.y - bounds.min.y) / 2;
  // Bar position relative to the panel origin, in world units (panel stays upright).
  const barOffsetY = panelCenter.y - panel.getWorldPosition(new Vector3()).y - halfHeight - barGap;

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

  const head = new Vector3();
  const forward = new Vector3();
  const panelWorld = new Vector3();
  const barWorld = new Vector3();
  let visible = true;
  let wristWasPressed = false;
  let barWasGrabbed = false;

  const placeBarUnderPanel = () => {
    panel.getWorldPosition(barWorld);
    barWorld.y += barOffsetY;
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
    panel.visible = visible;
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
      if (world.visibilityState.peek() !== VisibilityState.NonImmersive) summon();
      placeBarUnderPanel();
      apply();
    },
    hide() {
      if (!visible) return;
      visible = false;
      apply();
    },
    toggle() {
      if (visible) menu.hide();
      else menu.show();
    },
    update() {
      const immersive = world.visibilityState.peek() !== VisibilityState.NonImmersive;

      // Toggle inputs: keyboard, left controller menu button, wrist button (hands only).
      if (world.input.keyboard.getKeyDown(key)) menu.toggle();
      if (world.input.xr.gamepads.left?.getButtonDown(InputComponent.Menu)) {
        menu.toggle();
        haptics.play('left', 'click');
      }
      const handsActive = immersive && world.input.xr.isPrimary('hand', 'left');
      wrist.visible = handsActive;
      setInteractive(wristEntity, handsActive);
      const wristPressed = handsActive && wristEntity.hasComponent(Pressed);
      if (wristPressed && !wristWasPressed) menu.toggle();
      wristWasPressed = wristPressed;
      wristMaterial.opacity = wristEntity.hasComponent(Hovered) ? 1 : 0.85;

      if (!visible) return;

      // Move: the panel follows the grabbed bar and keeps facing the viewer.
      const grabbed = barEntity.hasComponent(Grabbed);
      if (grabbed) {
        bar.getWorldPosition(barWorld);
        barWorld.y -= barOffsetY;
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
