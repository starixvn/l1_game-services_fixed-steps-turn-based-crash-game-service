import { Table } from "sc-game-base";

export default class GameData extends Table.TableGameData {
    constructor(remainingTime) {
        super(remainingTime);
        this.betList = {};
    }

    addPlayerToBetList(playerId, { name, amount, rate, autoCashOut }) {
        this.betList[playerId] = { time: new Date(), playerId, name, amount, rate, autoCashOut };
    }
}
