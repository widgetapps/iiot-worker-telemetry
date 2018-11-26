'use strict';

require('./init')();

var config = require('./config'),
    mongoose = require('mongoose'),
    Telemetry = require('@terepac/terepac-models').Telemetry,
    Event = require('@terepac/terepac-models').Event,
    EventTelemetry = require('@terepac/terepac-models').EventTelemetry;

mongoose.Promise = global.Promise;
mongoose.connect(config.db);

var amqp = require('amqplib').connect(config.amqp);

amqp.then(function(conn) {
    return conn.createChannel();
}).then(function(ch) {
    let ex = 'telemetry';

    ch.assertExchange(ex, 'direct', {durable: true});

    return ch.assertQueue('', {durable: true}).then(function(ok) {
        ch.bindQueue(ok.queue, ex, 'telemetry');
        ch.bindQueue(ok.queue, ex, 'event');
        ch.bindQueue(ok.queue, ex, 'event_telemetry');

        return ch.consume(ok.queue, function(msg) {
            let insert = JSON.parse(msg.content.toString());
            let document = '';

            if (msg.fields.routingKey === 'telemetry') {
                document = new Telemetry(insert);
            } else if (msg.fields.routingKey === 'event') {
                document = new EventTelemetry(insert);
            } else if (msg.fields.routingKey === 'event_telemetry') {
                document = new Event(insert);
            }

            if (document === '') return;

            console.log(msg.fields.routingKey + ' - ' + insert); return;

            document.save(function (err, t) {
                if (err) {
                    console.log('Error: %s', err);
                } else {
                    console.log('Saved');
                    ch.ack(msg);
                }
            });

        }, {noAck: false});
    });

}).catch(console.warn);
