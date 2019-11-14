'use strict';

module.exports = {
    db: process.env.MONGO_STRING || 'mongodb://10.240.162.13,10.240.253.155/one-platform?replicaSet=rs0'
};
