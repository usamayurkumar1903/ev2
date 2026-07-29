import { createPortal } from 'react-dom';

/**
 * Renders children directly into document.body via a React portal.
 *
 * Why this is needed:
 * When a modal with position:fixed lives inside a container that has
 * overflow:auto, transform, or will-change set, the browser may create
 * a new stacking/containing-block context that breaks fixed positioning.
 * This makes modals appear at the scroll position instead of the viewport
 * center.  Portalling to document.body bypasses the entire parent chain
 * so position:fixed always means "relative to the actual viewport".
 */
export default function Portal({ children }) {
  return createPortal(children, document.body);
}
