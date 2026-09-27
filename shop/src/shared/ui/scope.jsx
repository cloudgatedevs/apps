import { createContext, forwardRef, useContext } from 'react';
const UiScope = createContext('shop-ui');
export const UiScopeProvider = UiScope.Provider;
export const UiPortalScope = forwardRef(function UiPortalScope({ children, className = '', style, ...props }, ref) {
  return <div {...props} ref={ref} className={`${useContext(UiScope)} ${className}`} style={{ ...style, display: 'contents' }}>{children}</div>;
});
