import {
  CapsuleGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Grabbed,
  Hovered,
  InputComponent,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  GrabSystem,
  Pressed,
  PokeInteractable,
  RayInteractable,
  Vector3,
  VisibilityState,
  type Entity,
  type Object3D,
  type UIKitMLAsset,
} from '@iwsdk/core';
import type { ExperienceContext } from '../../core/xr/experience.js';
import { makeManipulable } from '../interaction/manipulable.js';
import { requireElement } from './controls.js';
import { summonPose, yawToward, type SummonOptions } from './panel-placement.js';
import { createWristToggle } from './wrist-toggle.js';

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
  /** Keep the wrist and keyboard shortcut, without taking the main controller Menu/Y button. */
  controllerInputs?: boolean;
  /** Horizontal offset so two wrist shortcuts can coexist. */
  wristX?: number;
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
  setToggleShortcut(onActivate: () => void): void;
  update(): void;
  dispose(): void;
};

const setParentLocal = (object: Object3D, worldPosition: Vector3) => {
  object.position.copy(worldPosition);
  object.parent?.worldToLocal(object.position);
};

const wristIcon = (segments: readonly number[], color: string) => {
  const geometry = new BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  const halfWidth = 0.0013;
  for (let i = 0; i < segments.length; i += 6) {
    const x0 = segments[i]!, y0 = segments[i + 1]!, z0 = segments[i + 2]!;
    const x1 = segments[i + 3]!, y1 = segments[i + 4]!, z1 = segments[i + 5]!;
    const dx = x1 - x0, dz = z1 - z0;
    const length = Math.hypot(dx, dz) || 1;
    const ox = -dz / length * halfWidth, oz = dx / length * halfWidth;
    const base = vertices.length / 3;
    vertices.push(x0 + ox, y0, z0 + oz, x0 - ox, y0, z0 - oz,
      x1 + ox, y1, z1 + oz, x1 - ox, y1, z1 - oz);
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  const material = new MeshBasicMaterial({ color, side: DoubleSide, depthTest: false, depthWrite: false });
  const icon = new Mesh(geometry, material);
  icon.renderOrder = 101;
  return { icon, dispose: () => { geometry.dispose(); material.dispose(); } };
};

export const createPanelMenu = (ctx: ExperienceContext, options: PanelMenuOptions): PanelMenu => {
  const { world, theme, haptics } = ctx;
  const { nodeId, key = 'KeyM', barGap = 0.03, rootElementId = 'panel', inputs = true, controllerInputs = true, wristX = 0, summonOnShow = true, onVisibilityChange } = options;
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

  const barMaterial = new MeshBasicMaterial({ color: theme.colors.primary, transparent: true, opacity: 0.65, depthTest: false, depthWrite: false });
  const bar = new Mesh(new CapsuleGeometry(0.009, 0.11, 4, 12), barMaterial);
  bar.renderOrder = 100;
  bar.rotation.z = Math.PI / 2;
  bar.name = `${nodeId}-grab-bar`;
  const barEntity = world.createTransformEntity(bar);
  makeManipulable(barEntity, { grab: 'distance', rotate: false, scale: false });

  // Wrist button for hand tracking (left hand), pressed with the other hand's ray or pinch.
  const wristMaterial = new MeshBasicMaterial({ color: theme.colors.background, depthTest: false, depthWrite: false });
  const wrist = new Mesh(new CylinderGeometry(0.024, 0.024, 0.006, 24), wristMaterial);
  const windowsIcon = wristIcon([
    -0.010, 0.0035, -0.008, 0.006, 0.0035, -0.008,
    0.006, 0.0035, -0.008, 0.006, 0.0035, 0.005,
    0.006, 0.0035, 0.005, -0.010, 0.0035, 0.005,
    -0.010, 0.0035, 0.005, -0.010, 0.0035, -0.008,
    -0.006, 0.0035, 0.008, 0.010, 0.0035, 0.008,
    0.010, 0.0035, 0.008, 0.010, 0.0035, -0.005,
  ], theme.colors.primary);
  wrist.add(windowsIcon.icon);
  wrist.name = `${nodeId}-wrist-toggle`;
  wrist.position.set(wristX, 0.035, 0.07);
  const wristEntity = world.createTransformEntity(wrist, { parent: world.playerSpaceEntities.gripSpaces.left });
  const head = new Vector3();
  const forward = new Vector3();
  const panelWorld = new Vector3();
  const barWorld = new Vector3();
  const panelWorldRotation = new Quaternion();
  const barShapeRotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
  let visible = true;
  const wristToggle = createWristToggle();
  let onToggleShortcut: (() => void) | undefined;
  let barWasGrabbed = false;
  let wasImmersive = false;

  const placeBarUnderPanel = () => {
    panel.getWorldPosition(barWorld);
    barWorld.y += barOffsetY();
    setParentLocal(bar, barWorld);
    panel.getWorldQuaternion(panelWorldRotation);
    bar.quaternion.copy(panelWorldRotation).multiply(barShapeRotation);
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
  const setWristInteractive = (entity: Entity, on: boolean) => {
    setInteractive(entity, on);
    if (on && !entity.hasComponent(PokeInteractable)) entity.addComponent(PokeInteractable);
    if (!on && entity.hasComponent(PokeInteractable)) entity.removeComponent(PokeInteractable);
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
      if (barEntity.hasComponent(Grabbed)) world.getSystem(GrabSystem)?.forceRelease(barEntity);
      barWasGrabbed = false;
      visible = false;
      apply();
      onVisibilityChange?.(false);
    },
    toggle() {
      if (visible) menu.hide();
      else menu.show();
    },
    setToggleShortcut(onActivate) { onToggleShortcut = onActivate; },
    update() {
      const immersive = world.visibilityState.peek() !== VisibilityState.NonImmersive;
      if (immersive && !wasImmersive && visible && summonOnShow) {
        summon();
        placeBarUnderPanel();
        onVisibilityChange?.(true);
      }
      wasImmersive = immersive;

      // Toggle inputs: keyboard, left controller menu button, wrist button (hands only).
      if (!inputs) {
        wrist.visible = false;
        setWristInteractive(wristEntity, false);
      }
      const toggleShortcut = () => onToggleShortcut ? onToggleShortcut() : menu.toggle();
      if (inputs && world.input.keyboard.getKeyDown(key)) toggleShortcut();
      const left = inputs && controllerInputs ? world.input.xr.gamepads.left : undefined;
      if (left?.getButtonDown(InputComponent.Menu) || left?.getButtonDown(InputComponent.Y_Button)) {
        toggleShortcut();
        haptics.play('left', 'click');
      }
      const handsActive = inputs && immersive && world.input.xr.isPrimary('hand', 'left');
      wrist.visible = handsActive;
      setWristInteractive(wristEntity, handsActive);
      // Only a real press of the button counts: a fingertip poke, or the ray aimed at it plus a
      // pinch. Pinching while the ray merely hovers the button (e.g. grabbing something) must not.
      if (wristToggle.update(handsActive && wristEntity.hasComponent(Pressed), performance.now())) {
        toggleShortcut();
        ctx.sounds.play('click');
        haptics.play('right', 'click');
      }

      if (!visible) return;

      // Move: the panel follows the grabbed bar and keeps facing the viewer.
      const grabbed = barEntity.hasComponent(Grabbed);
      if (grabbed) {
        bar.getWorldPosition(barWorld);
        barWorld.y -= barOffsetY();
        setParentLocal(panel, barWorld);
        facePanelToHead();
        panel.getWorldQuaternion(panelWorldRotation);
        bar.quaternion.copy(panelWorldRotation).multiply(barShapeRotation);
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
      (wrist.geometry as CylinderGeometry).dispose();
      windowsIcon.dispose();
    },
  };

  placeBarUnderPanel();
  apply();
  return menu;
};
