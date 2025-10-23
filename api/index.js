const readline = require('readline');
let connectSSE = void 0;
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on('keypress', (str, key) => {
    console.log(`You pressed: ${str}`);
    if (key.name === 'q') {
        console.log('Exiting...');
        process.exit();
    }
    if (str == 'r' || str == "R") {
        if (connectSSE) connectSSE();
    }
});




function clearIntervals(Intervals = []) {
    // console.log("Intervals:",Intervals.length);
    // for (let i = 0; i < Intervals.length; i++) {
    //     // console.log(Intervals[i])
    //     if (!Intervals[i]._destroyed) {
    //         clearInterval(Intervals[i]);
    //     }
    // }
    for (let i = Intervals.length - 1; i >= 0; i--) {
        if (Intervals[i] && !Intervals[i]._destroyed) {
            clearInterval(Intervals[i]);
            Intervals.splice(i, 1);
        }
    }
};
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};
function millis_to_time_String(durationInMillis) {

    let millis = durationInMillis % 1000;
    let second = (durationInMillis / 1000) % 60;
    let minute = (durationInMillis / (1000 * 60)) //% 60;
    let hour = (durationInMillis / (1000 * 60 * 60));
    let time = `${Math.floor(hour)}小時${Math.floor(minute)}分鐘 ${Math.floor(second)}.${millis}秒`; //${Math.floor(millis)}`;
    return time
};
(async () => {
    const { EventSource } = require('eventsource')
    const charger_IPV4 = "192.168.137.---";

    // // const https="https";
    // // const backend = "carparktest3backend.onrender.com";

    const https = "https";
    const backend = process.argv.join(' ').match(/-wall-c/) ? "carparkvercelbackend-wall-c.vercel.app" : "express-flame-two.vercel.app";

    // //// const https = "https";
    // //// const backend = "carparkvercelbackend.vercel.app";

    // const https="http";
    // // const backend = "localhost:7000";
    // const backend = "192.168.31.18:7000";
    while (1) try {
        console.log(`http://${charger_IPV4}/control/calibrate`)
        // await fetch(`http://${charger_IPV4}/control/calibrate`)
        break;
    }
        catch (e) { console.log(e); await sleep(2000) }
    const isComplete_list = [];
    let fetch_count = 0;
    let predicted_moved_time = Date.now();
    let charger_moving_intervals = [setInterval(() => { }, 10)];
    await (async () => {
        const check_charger_complete_move = async () => {
            console.log(`Checking if charger has completed move: http://${charger_IPV4}/is_charger_complete_move`);
            fetch_count++;
            // const is_charger_complete_move = await fetch(`http://${charger_IPV4}/is_charger_complete_move`);
            if (!charger_moving_intervals.some(i => !i._destroyed)) return;
            // console.log(is_charger_complete_move.status)
            isComplete_list.push(true)//await (await is_charger_complete_move.blob()).text() === "1");
            const isComplete = isComplete_list.some(a => a);
            console.log([isComplete_list.length, isComplete, fetch_count]);
            if (isComplete) {
                clearIntervals(charger_moving_intervals);
                // clearTimeout(charger_moving_interval);
                console.log(`Charger has completed calibrate`);
                return true; // 返回完成狀態
            }
            return false; // 返回未完成狀態
        }

        return new Promise((resolve) => {
            charger_moving_intervals.push(setInterval(async () => {
                let completed;
                while (1) try {
                    completed = await check_charger_complete_move();
                    break;
                } catch (e) { console.log(e); await sleep(2000) }
                if (completed) {
                    clearIntervals(charger_moving_intervals);
                    resolve(); // 在完成後解析 Promise
                } else if (predicted_moved_time < Date.now())
                    predicted_moved_time = Date.now() + (15 * 1000);
            }, 2000));
        })
    })();
    let es = void 0;
    let appointment_Timeout = setTimeout(() => { });
    let now_spot = 0;
    connectSSE = () => {
        es = new EventSource(`${https}://${backend}/index_pub/event`)


        async function appointment(inst) { if (!inst) await sleep(2000); clearTimeout(appointment_Timeout); appointment_Timeout = setTimeout(connectSSE, 16 * 1000) }
        appointment()
        es.addEventListener('comment', (event) => {
            appointment()
            console.log(new Date(), ":", event.type, ":", event.data)
            fetch(`${https}://${backend}/index_loc/comment_cb`)
                .then((res) => {
                    return res.text();
                })
                .then((text) => {
                    console.log(new Date(), ":res.text:", text)
                })
                .catch(
                    (err) => {console.error(err);}
                );
        })

        es.addEventListener('call_charger_move_to', async (event) => {
            console.log(`${new Date()}`, ":", event.type, ":", event.data)
            await call_charger_move_to(event.data)
            now_spot = event.data
        })
        /*
        * This will listen for events with the field `event: notice`.
        */
        es.addEventListener('notice', (event) => {
            console.log(new Date(), ":", event.type, ":", event.data)
        })

        /*
        * This will listen for events with the field `event: update`.
        */
        es.addEventListener('update', (event) => {
            console.log(new Date(), ":", event.type, ":", event.data)
        })

        /*
        * The event "message" is a special case, as it will capture events _without_ an
        * event field, as well as events that have the specific type `event: message`.
        * It will not trigger on any other event type.
        */
        es.addEventListener('message', (event) => {
            console.log(new Date(), ":", event.type, ":", event.data)
        })

        /**
         * To explicitly close the connection, call the `close` method.
         * This will prevent any reconnection from happening.
         */
        // setTimeout(() => {
        //     es.close()
        // }, 10_000)
        let last_error = Date.now();
        es.addEventListener('error', (event) => {
            console.log(event, millis_to_time_String(Math.abs(last_error - (last_error = Date.now()))))
            console.log(new Date(), ":", event.type,);
        })

        es.addEventListener('reconnect', (event) => {
            es.close();
            console.log("reconnect", new Date(), ":", event.type);
            connectSSE();
        });
    }
    connectSSE();

    async function call_charger_move_to(spot, _id = void 0) {//added ,_id = void 0
        console.log(`Moving to spot ${spot}`);
        let command = "calibrate";
        /*if (spot != 0)*/ command = `move?spot=${spot}`;
        console.log(`http://${charger_IPV4}/control/${command}`);
        let result = { "ok": true };
        console.log(result.ok);
        // clearInterval(charger_moving_interval);
        // clearTimeout(charger_moving_interval);
        let need_wait = 0;
        // if (spot == 0) need_wait = 0;
        if (spot != now_spot) need_wait = (10 * 1000);
        // else need_wait = parseInt(await (await (await fetch(`http://${charger_IPV4}/how_long`)).blob()).text());
        console.log("need_wait");
        console.log(need_wait);
        console.log(millis_to_time_String(need_wait));
        predicted_moved_time = Date.now() + (isNaN(need_wait) ? 0 : need_wait);
        console.log(Date.now());
        console.log(millis_to_time_String(Date.now()));
        console.log(predicted_moved_time);
        console.log(millis_to_time_String(predicted_moved_time));

        let push = void 0;
        while (true) {
            try {
                console.log(new Date(),`${https}://${backend}/index_loc/push?need_wait=${need_wait}&sport=${spot}`);
                push = await fetch(`${https}://${backend}/index_loc/push?need_wait=${need_wait}&sport=${spot}`);//<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
                break;
            } catch (e) { console.log(e); await sleep(2000) }
        }
        console.log(push.ok);
        console.log("sleeping");
        // await sleep(need_wait);
        console.log("sleeped-----------------------------------------------------------------------------------------------------------------------");
        const isComplete_list = [];
        let fetch_count = 0;
        const check_charger_complete_move = async () => {
            console.log(`Checking if charger has completed move: http://${charger_IPV4}/is_charger_complete_move`);
            fetch_count++;
            // const is_charger_complete_move = 1//await fetch(`http://${charger_IPV4}/is_charger_complete_move`);
            if (!charger_moving_intervals.some(i => !i._destroyed)) return;
            // console.log(is_charger_complete_move.status)
            isComplete_list.push(true)//await (await is_charger_complete_move.blob()).text() === "1");
            const isComplete = (predicted_moved_time < Date.now())//isComplete_list.some(a => a);
            console.log([isComplete_list.length, isComplete, fetch_count]);
            if (isComplete) {
                clearIntervals(charger_moving_intervals);
                // clearTimeout(charger_moving_interval);
                console.log(`Charger has completed the move to spot ${spot}`);
                return true; // 返回完成狀態
            }
            return false; // 返回未完成狀態
        }

        return new Promise((resolve) => {
            charger_moving_intervals.push(setInterval(async () => {
                let completed;
                while (1) try {
                    completed = await check_charger_complete_move();
                    break;
                } catch (e) { console.log(e); await sleep(2000) }
                if (completed) {
                    clearIntervals(charger_moving_intervals);
                    resolve(); // 在完成後解析 Promise
                } else if (predicted_moved_time < Date.now())
                    predicted_moved_time = Date.now() + (15 * 1000);
            }, 2000));
        });
        // return new Promise(async (resolve) => {
        //     let completed = false;
        //     while (!completed) {
        //         completed = await check_charger_complete_move();
        //         if (completed) {
        //             resolve(); // 在完成後解析 Promise
        //         } else if (predicted_moved_time < Date.now())
        //             predicted_moved_time = Date.now() + (15 * 1000);
        //     }
        // });
    }


    // eventSource = new EventSource(`${API_BASE_URL}/events?_id="${cookie.load("_id")}"`);
    // eventSource.onmessage = (event) => {
    //     const data = (event.data);
    //     console.log('接收到事件數據:', data);
    // }
})();
