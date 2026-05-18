import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

export function useRealtimeCollection(queryRef) {
  const [state, setState] = useState({ data: [], loading: !!queryRef, error: null });

  useEffect(() => {
    if (!queryRef) {
      setState({ data: [], loading: false, error: null });
      return undefined;
    }

    setState({ data: [], loading: true, error: null });

    const unsubscribe = onSnapshot(queryRef, (snapshot) => {
      setState({
        data: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        loading: false,
        error: null
      });
    }, (error) => {
      console.warn('Realtime collection listener failed:', error);
      setState({ data: [], loading: false, error });
    });

    return unsubscribe;
  }, [queryRef]);

  return state;
}
