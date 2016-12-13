'use strict';

module.exports = {
    app: {
        title: 'terepac-api'
    },
    ip: process.env.IP || '127.0.0.1',
    amqp: process.env.AMQP || 'amqp://localhost'
};