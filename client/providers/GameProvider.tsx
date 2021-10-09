import axios from "axios";
import React, { useCallback, useContext, useMemo, useState } from "react";

// TOOD: We need a monorepo
export interface InfoSource {
    id: string
    type: string
    disabled: boolean
    data: Record<string, any>
}

export interface Game {
    id: string
    name: string
    infoSources: InfoSource[]
    syncing: boolean;
}

export interface GameCtx {
    games: Game[]
    addGame: (name: string) => Promise<void>
    syncGame: (id: string) => Promise<void>
    deleteGame: (id: string) => Promise<void>
    disableInfoSource: (game: Game, infoSource: InfoSource) => Promise<void>
}

export const GameContext = React.createContext<GameCtx>({
    games: [],
    addGame: async () => { },
    syncGame: async () => { },
    deleteGame: async () => { },
    disableInfoSource: async () => { },
});

export function useGameContext() {
    const context = useContext(GameContext);

    return context as GameCtx;
}

export const GameProvider: React.FC<{ initialGames: Game[] }> = ({ children, initialGames }) => {
    const [games, setGames] = useState(initialGames);

    const addGame = useCallback(async (name: string) => {
        const { data } = await axios.post<any>("http://localhost:3002/game", { search: name });

        setGames([data, ...games]);
    }, [games, setGames]);


    const syncGame = useCallback(async (gameId: string) => {
        const { data } = await axios.post<any>(`http://localhost:3002/game/${gameId}/sync`);

        setGames([
            data!,
            ...games.filter(game => game.id !== gameId),
        ]);
    }, [games, setGames]);


    const deleteGame = useCallback(async (gameId: string) => {
        await axios.delete(`http://localhost:3002/game/${gameId}`);

        setGames(games.filter(game => game.id !== gameId));
    }, [games, setGames])

    const disableInfoSource = useCallback(async (game: Game, infoSource: InfoSource) => {
        const { data } = await axios.post<any>(`http://localhost:3002/info-source/${infoSource.id}/disable`);

        game.infoSources = [
            data,
            ...game.infoSources.filter(({ id }) => id !== infoSource.id),
        ];

        setGames([
            game!,
            ...games.filter(({ id }) => id !== game.id),
        ]);
    }, [games, setGames]);


    const contextValue = useMemo(() => ({
        games,
        addGame,
        syncGame,
        deleteGame,
        disableInfoSource
    }), [games, addGame, syncGame, deleteGame, disableInfoSource]);

    return (
        <GameContext.Provider value={contextValue}>
            {children}
        </GameContext.Provider>
    )
}