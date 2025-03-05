import { PlayerIds } from "../constants/constants";
import { signName, authorize } from "../handler/authorize-handler";
import { setDefaultBalance, getSSOToken } from "../handler/sso-handler";

const setupStressUsers = async () => {
    for await (const playerId of PlayerIds) {
        const ssoToken = await getSSOToken(playerId);
        const authorizeInfo = await authorize(ssoToken);

        await setDefaultBalance(playerId);
        await signName(authorizeInfo);
        console.log(`${playerId} - done`);
    }

    console.log("SETUP TEST USERS DONE !");
};

setupStressUsers();
