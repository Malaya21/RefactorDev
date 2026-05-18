import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

export function useRealtimeDocument(docRef) {
  const [state, setState] = useState({ data: null, loading: !!docRef, exists: false, error: null });

  useEffect(() => {
    if (!docRef) {
      setState({ data: null, loading: false, exists: false, error: null });
      return undefined;
    }

    setState({ data: null, loading: true, exists: false, error: null });

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      setState({
        data: snapshot.exists() ? snapshot.data() : null,
        loading: false,
        exists: snapshot.exists(),
        error: null
      });
    }, (error) => {
      console.warn('Realtime document listener failed:', error);
      setState({ data: null, loading: false, exists: false, error });
    });

    return unsubscribe;
  }, [docRef]);

  return state;
}
