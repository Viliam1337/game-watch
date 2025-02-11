import { Box } from '@chakra-ui/react';
import { RegisterUserDto, UpdateUserSettingsDto, UserDto, UserState } from '@game-watch/shared';
import axios from 'axios';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { v4 as uuidV4 } from 'uuid';

import { LoadingSpinner } from '../components/LoadingSpinner';
import { useHttp } from '../util/useHttp';

export interface UserCtx {
    user: UserDto
    registerUser: (params: Omit<RegisterUserDto, 'id'>) => Promise<void | Error>
    loginUser: (params: { username: string, password: string }) => Promise<void | Error>
    logoutUser: () => Promise<void>
    updateUserSettings: (params: UpdateUserSettingsDto) => Promise<void>
    deleteUser: () => Promise<void>
}

export const UserContext = React.createContext<UserCtx | null>(null);

export function useUserContext() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('UserContext must be used inside UserProvider');
    }

    return context;
}

export interface LocalUserData {
    id: string
    state: UserState
}

export const getLocalStoredUser = (): LocalUserData | null => {
    const localUserData = localStorage.getItem('user');
    if (!localUserData) {
        return null;
    }

    return JSON.parse(localUserData);
};

export const setLocalStoredUser = (data: LocalUserData | null) => {
    if (data === null) {
        localStorage.removeItem('user');
    } else {
        localStorage.setItem('user', JSON.stringify(data));
    }
};

export const UserProvider: React.FC<{
    children: React.ReactChild,
}> = ({ children }) => {
    const { withRequest } = useHttp();
    const { withRequest: withRequestWithoutLogout } = useHttp(false);
    const [user, setUser] = useState<UserDto | null>(null);

    useEffect(() => {
        async function fetchUser() {
            await withRequestWithoutLogout(async http => {
                try {
                    const { data } = await http.get('/user');
                    setLocalStoredUser(data);
                    setUser(data);
                } catch (error) {
                    if (axios.isAxiosError(error) && error.response?.status === 401) {
                        const localUserData = getLocalStoredUser();

                        // TODO: What to do for an registered user?
                        // => Maybe just the same? Or show him a login form directly?
                        // if (!localUserData || localUserData.state === UserState.Trial) {

                        // Just create a new trial user.
                        const { data } = await http.post<UserDto>(
                            '/auth/create',
                            // TODO: We shouldn't use the same route for two things
                            {
                                id: localUserData?.state === UserState.Trial
                                    ? localUserData?.id
                                    : uuidV4()
                            }
                        );

                        setLocalStoredUser(data);
                        setUser(data);

                        return;
                    }

                    throw error;
                }
            });
        }
        fetchUser();
    }, [withRequestWithoutLogout]);

    const registerUser = useCallback(async (params: Omit<RegisterUserDto, 'id'>) => {
        return await withRequest(async http => {
            const { data } = await http.post<UserDto>('/auth/register', {
                id: user?.id,
                ...params
            });

            setLocalStoredUser(data);
            setUser(data);
        }, () => { });
    }, [withRequest, user]);

    const loginUser = useCallback(async (params: { username: string, password: string }) => {
        return await withRequest(async http => {
            const { data } = await http.post<UserDto>('/auth/login', params);

            setLocalStoredUser(data);
            setUser(data);
        }, () => { });
    }, [withRequest]);

    const logoutUser = useCallback(async () => {
        await withRequest(async http => {
            await http.post('/auth/logout');

            setLocalStoredUser(null);
            location.href = '/?loggedOut=true';
        });
    }, [withRequest]);

    const updateUserSettings = useCallback(async (params: UpdateUserSettingsDto) => {
        await withRequest(async http => {
            const { data } = await http.put<UserDto>('/user', {
                id: user?.id,
                ...params
            });

            setLocalStoredUser(data);
            setUser(data);
        });
    }, [withRequest, user]);

    const deleteUser = useCallback(async () => {
        await withRequest(async http => {
            await http.delete(`/user`);
        });
    }, [withRequest]);

    const contextValue = useMemo(() => ({
        // We show a loading screen while no user is available
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        user: user!,
        registerUser,
        loginUser,
        logoutUser,
        updateUserSettings,
        deleteUser
    }), [user, registerUser, loginUser, logoutUser, updateUserSettings, deleteUser]);

    return (
        <UserContext.Provider value={contextValue}>
            {!user
                ? <Box h="100vh" position="relative">
                    <LoadingSpinner size="xl" />
                </Box>
                : children
            }
        </UserContext.Provider>
    );
};
