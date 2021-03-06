/*
 * js-Round1
 * https://github.com/HQInterview/Nodejs-Round1
 *
 * Copyright (c) 2015 Michael Bowerman
 * Licensed under the GPL license.
 */

'use strict';

var PaymentProcessor = require('./PaymentProcessor.js');

var util = require('util');
var Hapi = require('hapi');
var Joi = require('joi');
var GoodWinston = require('good-winston');
var winston = require('winston');

function PaymentServer(basePath, connectionPort) {
  this.basePath = basePath;
  this.connectionPort = connectionPort;
}

PaymentServer.prototype =  {
  constructor: PaymentServer,

  create_listener: function() {

    var server = new Hapi.Server();

    server.register({
      register: require('good'),
      options: {
        reporters: [
          new GoodWinston({
            ops: '*',
            request: '*',
            response: '*',
            log: '*',
            error: '*'
          }, winston)
        ]
      }
    }, function(err) {
      if(err) {
        return server.log(['error'],'good load error: ' + err);
      }
    });

    if( this.connectionPort ) {
      server.connection({ port: this.connectionPort });
    }
    else {
      server.connection({ port: process.env.PORT });
    }

    server.route({
      method : "GET",
      path : '/{param*}',
      handler : {
        directory : {
          path : this.basePath + '/public',
      listing : true
        }
      }
    });

    server.route({
      method : "GET",
      path : '/assets/{param*}',
      handler : {
        directory : {
          path : this.basePath + '/bower_components',
      listing : true
        }
      }
    });

    var payment_schema = Joi.object().keys({
      intent: Joi.string().required(),
      payer: Joi.object().keys({
        payment_method: Joi.string().required(),
        funding_instruments: Joi.array().items(Joi.object({
          credit_card: Joi.object({
            type: Joi.string().required(),
            number: Joi.string().creditCard().required(),
            expire_month: Joi.string().required(),
            expire_year: Joi.number().integer().required(),
            cvv2: Joi.number().integer().less(999).required(),
            first_name: Joi.string().required(),
            last_name: Joi.string().required(),
            billing_address: Joi.object({
              line1: Joi.string().required(),
              city: Joi.string().required(),
              state: Joi.string().length(2).required(),
              postal_code: Joi.number().integer().less(99999).required(),
              country_code: Joi.string().length(2).required()
            }).optional()
          }).required()
        }).required())
      }),
      transactions: Joi.array().items(Joi.object({
        amount: Joi.object({
          total: Joi.number().integer(),
          currency: Joi.string(),
          details: Joi.object({
            subtotal: Joi.number(),
            tax: Joi.number(),
            shipping: Joi.number(),
          }).optional(),
        }).required(),
        description: Joi.string(),
      })),
    }).required();

    var processor = new PaymentProcessor();
    server.route({
      method: ['POST'],
      path: '/ccpay',
      config: {
        handler: function(req, reply) {
          processor.processPaymentRequest(req.payload, function(error,response){
            reply(error,
              util.inspect(response, {showHidden: false, depth: null}));
          });
        },
        validate: { payload: payment_schema }
      }
    });

    return server;
  },
};

module.exports = PaymentServer;
