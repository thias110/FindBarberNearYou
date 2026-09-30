import { Component, type ErrorInfo, type ReactNode } from "react";

interface MapErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface MapErrorBoundaryState {
  hasError: boolean;
}

// Une exception de rendu carte ne doit jamais casser la liste : ce garde-fou
// React complète la gestion des erreurs asynchrones du moteur MapLibre (que
// l'ErrorBoundary, par nature, ne peut pas intercepter).
export class MapErrorBoundary extends Component<
  MapErrorBoundaryProps,
  MapErrorBoundaryState
> {
  state: MapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("BarbersMap render error", error, info);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
