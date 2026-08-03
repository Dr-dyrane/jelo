export {
  INITIAL_WORKSPACE_DOCK_SCROLL_STATE,
  WORKSPACE_DOCK_GEOMETRY,
  WORKSPACE_DOCK_SCROLL_THRESHOLDS,
  resolveActiveWorkspaceNavigationItem,
  resolveAdaptiveWorkspaceDockMode,
  updateWorkspaceDockScrollState,
  type AdaptiveWorkspaceDockMode,
  type DockContextDescriptor,
  type WorkspaceDockScrollState,
  type WorkspaceNavigationDescriptor,
} from './dock-model';
export {
  createDockFabRegistry,
  registerDockFab,
  resolveDockFab,
  unregisterDockFab,
  type DockFabRegistration,
  type DockFabRegistry,
  type DockFabRegistryEntry,
} from './fab-registry';
