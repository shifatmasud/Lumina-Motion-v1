
import { useState, useCallback, useRef } from 'react';

export const useHistory = <T>(initialState: T) => {
  const [state, setState] = useState({
    history: [initialState],
    index: 0,
  });
  const debounceTimerRef = useRef<number | null>(null);

  const { history, index } = state;
  const currentState = history[index];

  const updateState = useCallback((
    value: T | ((prevState: T) => T),
    isDebounced: boolean = false
  ) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const commit = (prevState: { history: T[], index: number }) => {
        const currentHistoryState = prevState.history[prevState.index];
        const newState = typeof value === 'function' 
          ? (value as (prevState: T) => T)(currentHistoryState) 
          : value;
        const newHistory = prevState.history.slice(0, prevState.index + 1);
        
        return {
            history: [...newHistory, newState],
            index: newHistory.length,
        };
    };

    if (isDebounced) {
        // Immediate UI update without adding to history stack
        setState(prevState => {
            const currentHistoryState = prevState.history[prevState.index];
            const newState = typeof value === 'function' 
              ? (value as (prevState: T) => T)(currentHistoryState) 
              : value;
            const newHistory = [...prevState.history];
            newHistory[prevState.index] = newState;
            return { ...prevState, history: newHistory };
        });

        // Debounced commit to history
        debounceTimerRef.current = window.setTimeout(() => {
            setState(prevState => commit(prevState));
        }, 400);
    } else {
        // Immediate commit to history
        setState(prevState => commit(prevState));
    }
  }, []);

  const undo = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setState(prevState => prevState.index > 0 ? { ...prevState, index: prevState.index - 1 } : prevState);
  }, []);

  const redo = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setState(prevState => prevState.index < prevState.history.length - 1 ? { ...prevState, index: prevState.index + 1 } : prevState);
  }, []);
  
  const resetHistory = useCallback((newState: T) => {
    setState({ history: [newState], index: 0 });
  }, []);

  return {
    state: currentState,
    setState: updateState,
    undo,
    redo,
    resetHistory,
    canUndo: index > 0,
    canRedo: index < history.length - 1,
  };
};
