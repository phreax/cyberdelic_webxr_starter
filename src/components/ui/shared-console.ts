import { Quaternion, Vector3, VisibilityState, type Object3D, type UIKitMLAsset } from '@iwsdk/core';
import type { ExperienceContext } from '../../core/xr/experience.js';
import { bindButton, requireElement, type BindOptions } from './controls.js';
import { createPanelMenu } from './panel-menu.js';
import { consoleArcPoses } from './panel-placement.js';
import { bindExampleSwitcher, bindSessionSection } from './standard-sections.js';

/** The picker is one stable window; each scene's controls and selected-object inspector sit beside it. */
export const bindSharedConsole = (
  ctx: ExperienceContext,
  main: UIKitMLAsset,
  common: BindOptions,
  mainMenu?: { readonly visible: boolean; show(): void; hide(): void },
  otherHeaders: UIKitMLAsset[] = [],
) => {
  const { world, track } = ctx;
  const picker = world.requireSceneObject<UIKitMLAsset>('demos-panel');
  requireElement(picker, 'panel').setProperties({ backgroundColor: '#152322ed' });
  const demos = requireElement(picker, 'console-demos');
  const session = requireElement(picker, 'console-session');
  const title = requireElement(picker, 'demos-title');
  const cameraPosition = new Vector3();
  const cameraForward = new Vector3();
  const yAxis = new Vector3(0, 1, 0);
  const parentQuaternion = new Quaternion();
  const placement = ctx.examples?.consolePlacement;
  let layoutPlaced = false;
  let wasImmersive = false;
  let immersiveFrames = 0;
  const placeAt = (id: string, pose: { position: [number, number, number]; yaw: number }) => {
    const object = world.getSceneObject<Object3D>(id);
    if (!object) return;
    object.position.set(...pose.position);
    object.parent?.worldToLocal(object.position);
    object.quaternion.setFromAxisAngle(yAxis, pose.yaw);
    if (object.parent) object.quaternion.premultiply(object.parent.getWorldQuaternion(parentQuaternion).invert());
  };
  const placeGroup = () => {
    const anchor = placement?.anchor;
    if (!anchor) return;
    const poses = consoleArcPoses(anchor);
    placeAt('demos-panel', poses.picker);
    const demoNode = ctx.examples?.list.find((demo) => demo.id === ctx.examples?.current)?.panelNode;
    if (demoNode) placeAt(demoNode, poses.demo);
    for (const id of ['snake-params', 'snake-edit']) placeAt(id, poses.inspector);
  };
  const groupMenus: Array<{ readonly visible: boolean; show(): void; hide(): void }> = [];
  let restoreVisibility: boolean[] = [];
  const pickerMenu = track(createPanelMenu(ctx, { nodeId: 'demos-panel', key: 'KeyM', summonOnShow: false }));
  const show = (section: 'object' | 'demos' | 'session') => {
    if (section === 'object') { mainMenu?.show(); return; }
    pickerMenu.show();
    const settings = section === 'session';
    demos.setProperties({ display: settings ? 'none' : 'flex' });
    session.setProperties({ display: settings ? 'flex' : 'none' });
    title.setProperties({ text: settings ? 'Session' : 'Demos' });
  };
  show('demos');
  const allMenus = () => [mainMenu, ...groupMenus].filter((menu): menu is NonNullable<typeof menu> => !!menu);
  const toggleAll = () => {
    const menus = allMenus();
    if (pickerMenu.visible || menus.some((menu) => menu.visible)) {
      restoreVisibility = menus.map((menu) => menu.visible);
      pickerMenu.hide();
      menus.forEach((menu) => menu.hide());
    } else {
      pickerMenu.show();
      menus.forEach((menu, index) => { if (index === 0 || restoreVisibility[index]) menu.show(); });
    }
  };
  pickerMenu.setToggleShortcut(toggleAll);
  track(bindButton(picker, 'btn-settings', { ...common, onClick: () => show('session') }));
  track(bindButton(picker, 'btn-back-demos', { ...common, onClick: () => show('demos') }));
  track(bindButton(picker, 'btn-close-demos', { ...common, onClick: () => pickerMenu.hide() }));
  for (const header of otherHeaders) track(bindButton(header, 'btn-settings', { ...common, onClick: () => show('session') }));
  bindExampleSwitcher(ctx, picker, common, () => mainMenu?.show());
  bindSessionSection(ctx, picker, common);
  ctx.onFrame(() => {
    pickerMenu.update();
    const immersive = world.visibilityState.peek() !== VisibilityState.NonImmersive;
    if (!immersive && wasImmersive) {
      if (placement) placement.anchor = undefined;
      layoutPlaced = false;
      immersiveFrames = 0;
    }
    if (immersive && !layoutPlaced) {
      immersiveFrames += 1;
      // XR head pose may still contain the desktop camera transform on the
      // first frame after entry. Wait for tracking before fixing the anchor.
      if (!placement?.anchor && immersiveFrames < 5) return;
      if (placement && !placement.anchor) {
        world.camera.getWorldPosition(cameraPosition);
        world.camera.getWorldDirection(cameraForward);
        placement.anchor = { position: cameraPosition.toArray() as [number, number, number],
          forward: cameraForward.toArray() as [number, number, number] };
      }
      placeGroup();
      layoutPlaced = true;
    }
    wasImmersive = immersive;
    if (world.input.keyboard.getKeyDown('KeyS')) show('session');
  });
  return { show, pickerMenu, registerGroupMenus: (...menus: typeof groupMenus) => groupMenus.push(...menus) };
};
