import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, getSession, setSession, post } from './api';
import type { Actor, Tokens, SellerContext } from './types';
const AuthContext = createContext<ReturnType<typeof useAuthState> | null>(null);
function useAuthState() {
  const [session, update] = useState(getSession);
  const [selected, setSelected] = useState(() => sessionStorage.getItem('stockout.sellerId') || '');
  const queryClient = useQueryClient();
  const getSessionUserId = useRef(session?.userId);
  useEffect(() => {
    const listener = () => {
      const next = getSession();
      if (!next || next.userId !== getSessionUserId.current) {
        queryClient.clear();
        setSelected('');
        sessionStorage.removeItem('stockout.sellerId');
      }
      getSessionUserId.current = next?.userId;
      update(next);
    };
    window.addEventListener('stockout-session', listener);
    return () => window.removeEventListener('stockout-session', listener);
  }, [queryClient]);
  const actor = useQuery({
    queryKey: ['actor', session?.userId],
    queryFn: () => get<Actor>('/api/v1/marketplace/actors/me'),
    enabled: !!session,
    retry: false,
  });
  const contexts = actor.data?.sellerContexts || [];
  const seller = contexts.find((s) => s.sellerId === selected) || contexts[0];
  const selectSeller = (id: string) => {
    setSelected(id);
    sessionStorage.setItem('stockout.sellerId', id);
  };
  const signIn = (tokens: Tokens) => {
    if (!tokens.accessToken || !tokens.refreshToken)
      throw new Error('The server did not return a complete login session.');
    queryClient.clear();
    setSession(tokens);
  };
  const logout = async () => {
    try {
      await post('/api/v1/auth/logout', { refreshToken: getSession()?.refreshToken });
    } finally {
      setSession(null);
      queryClient.clear();
    }
  };
  return {
    session,
    signIn,
    logout,
    actor,
    seller: seller as SellerContext | undefined,
    contexts,
    selectSeller,
  };
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useAuthState();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('Missing AuthProvider');
  return auth;
}
