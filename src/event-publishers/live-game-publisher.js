import { Core } from "sc-game-base";

export default class LiveGamePublisher extends Core.BaseEventPublishers.BaseEventPublisher {
    publish(multiplier, liveTime) {
        this.publishToAllUsers({ c: { m: multiplier, t: liveTime } });
    }
}
