'use strict';


var init = require('./init')(),
    config = require('./config'),
    mongoose = require('mongoose'),
    Telemetry = require('@terepac/terepac-models').Telemetry;

mongoose.connect(config.db);
var amqp = require('amqplib').connect(config.amqp);

amqp.then(function(conn) {
    return conn.createChannel();
}).then(function(ch) {
    var q = 'one.telemetry';

    return ch.assertQueue(q).then(function(ok) {
        return ch.consume(q, function(msg) {
            var insert = JSON.parse(msg.content.toString());

            var telemetry = new Telemetry(insert);
            telemetry.save(function (err, telemetry) {
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
