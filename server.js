'use strict';

require('./init')();

let config = require('./config'),
    mongoose = require('mongoose'),
    Telemetry = require('@terepac/terepac-models').Telemetry,
    Event = require('@terepac/terepac-models').Event,
    EventTelemetry = require('@terepac/terepac-models').EventTelemetry;

let dbOptions = {
    useNewUrlParser: true,
    useCreateIndex: true
};

mongoose.Promise = global.Promise;
//mongoose.connect(config.db, dbOptions);

mongoose.connect(config.db, dbOptions, function(err) {
    if (err) {
        debugLog('Error connecting to MongoDB.');
    } else {
        debugLog('Connected to MongoDB');
    }
});

let amqp = require('amqplib').connect(config.amqp);

amqp.then(function(conn) {
    return conn.createChannel();
}).then(function(ch) {
    let ex = 'telemetry';

    ch.assertExchange(ex, 'direct', {durable: true, });

    return ch.assertQueue('telemetry', {durable: true}).then(function(ok) {
        ch.bindQueue('telemetry', ex, 'telemetry');
        ch.bindQueue('telemetry', ex, 'event');
        ch.bindQueue('telemetry', ex, 'event_telemetry');

        return ch.consume('telemetry', function(msg) {
            let insert = JSON.parse(msg.content.toString());
            let document = '';

            //console.log('Got routing key: %s', msg.fields.routingKey);

            if (msg.fields.routingKey === 'telemetry') {
                //console.log('Create telemetry document.');
                document = new Telemetry(insert);
            } else if (msg.fields.routingKey === 'event_telemetry') {
                //console.log('Create event telemetry document.');
                document = new EventTelemetry(insert);
            } else if (msg.fields.routingKey === 'event') {
                //console.log('Create event document.');
                document = new Event(insert);
            } else {
                ch.ack(msg);
                return;
            }

            document.save(function (err, t) {
                if (err) {
                    debugLog('DB Error: ' + err);
                } else {
                    //console.log('Saved');
                    ch.ack(msg);
                }
            });

        }, {noAck: false});
    });

}).catch(function (err) {
    debugLog('RabbitMQ Error: ' + JSON.stringify(err));
});


function debugLog(message) {
    let date = new Date();
    console.log(date.toISOString() + ' ' + message);
}

/**
 * Handle the different ways an application can shutdown
 */

function handleAppExit (options, err) {
    debugLog('App Exit!');
    if (err) {
        debugLog('App Exit Error: ' + JSON.stringify(err));
    }

    if (options.cleanup) {
        // Cleanup
    }

    if (options.exit) {
        process.exit();
    }
}

process.on('exit', handleAppExit.bind(null, {
    cleanup: true
}));

process.on('SIGINT', handleAppExit.bind(null, {
    exit: true
}));

process.on('uncaughtException', handleAppExit.bind(null, {
    exit: true
}));
