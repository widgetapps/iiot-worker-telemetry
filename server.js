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

let dbConnected = false;

mongoose.Promise = global.Promise;
//mongoose.connect(config.db, dbOptions);

let conn = mongoose.connection;
conn.on('connecting', function() {
    debugLog('Connecting to MongoDB...');
});
conn.on('error', function(error) {
    console.error('Error in MongoDB connection: ' + error);
    mongoose.disconnect();
});
conn.on('connected', function() {
    dbConnected = true;
    debugLog('Connected to MongoDB.');
});
conn.once('open', function() {
    debugLog('Connection to MongoDB open.');
});
conn.on('reconnected', function () {
    dbConnected = true;
    debugLog('Reconnected to MongoDB');
});
conn.on('disconnected', function() {
    dbConnected = false;
    debugLog('Disconnected from MongoDB.');
    mongoose.connect(config.db, config.dbOptions);
});

mongoose.connect(config.db, dbOptions);

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
            if (!dbConnected) {
                ch.nack(msg, true);
                return;
            }

            let insert = JSON.parse(msg.content.toString());
            insert.created = new Date();

            let document = '';

            //console.log('Got routing key: %s', msg.fields.routingKey);

            if (msg.fields.routingKey === 'telemetry') {
                //console.log('Create telemetry document.');
                //document = new Telemetry(insert);

                Telemetry.create(insert, function(err) {
                    if (err) {
                        debugLog('DB Error: ' + err);
                        ch.nack(msg, true);
                    } else {
                        //console.log('Saved');
                        ch.ack(msg);
                    }
                });

            } else if (msg.fields.routingKey === 'event_telemetry') {
                //console.log('Create event telemetry document.');
                //console.log(JSON.stringify(insert));
                //document = new EventTelemetry(insert);

                EventTelemetry.create(insert, function(err) {
                    console.log('Event Telemetry created?');
                    if (err) {
                        debugLog('DB Error: ' + err);
                        ch.nack(msg, true);
                    } else {
                        //console.log('Saved');
                        ch.ack(msg);
                    }
                });

            } else if (msg.fields.routingKey === 'event') {
                //console.log('Create event document.');
                //document = new Event(insert);

                Event.create(insert, function(err) {
                    if (err) {
                        debugLog('DB Error: ' + err);
                        ch.nack(msg, true);
                    } else {
                        //console.log('Saved');
                        ch.ack(msg);
                    }
                });

            } else {
                ch.nack(msg);
                return;
            }

            /*
            document.save(function (err, t) {
                console.log('Save called');
                if (err) {
                    debugLog('DB Error: ' + err);
                    ch.nack(msg, true);
                } else {
                    console.log('Saved');
                    ch.ack(msg);
                }
            });
             */

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
