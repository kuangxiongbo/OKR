import { useState, useEffect } from 'react';
import { User } from '../types';
import { getCurrentUser, subscribeToUser } from '../services/okrService';

export const useCurrentUser = () => {
    const [user, setUser] = useState<User | null>(getCurrentUser());

    useEffect(() => {
        // Sync with current value initially
        setUser(getCurrentUser());
        
        const unsubscribe = subscribeToUser((newUser) => {
            setUser(newUser);
        });
        return unsubscribe;
    }, []);

    return user;
};