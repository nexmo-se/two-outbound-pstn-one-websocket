'use strict'

//-------------

require('dotenv').config();

//--- for Neru installation ----
const neruHost = process.env.NERU_HOST;
console.log('neruHost:', neruHost);

//--
const express = require('express');
const bodyParser = require('body-parser')
const app = express();
const expressWs = require('express-ws')(app);
const Vonage = require('@vonage/server-sdk');

app.use(bodyParser.json());

//---- CORS policy - Update this section as needed ----

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "OPTIONS,GET,POST,PUT,DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
  next();
});

//-------

const servicePhoneNumber = process.env.SERVICE_PHONE_NUMBER;
console.log("Service phone number:", servicePhoneNumber);

const calleeNumber1 = process.env.CALLEE_NUMBER_1;
const calleeNumber2 = process.env.CALLEE_NUMBER_2;

//-------------

const options = {
  debug: true,
  // apiHost: "api-us-3.vonage.com"
  apiHost: "api-us-4.vonage.com"
};

const vonage = new Vonage({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET,
  applicationId: process.env.APP_ID,
  privateKey: './.private.key'
}, options);

//-------------------

// WebSocket server
const processorServer = process.env.PROCESSOR_SERVER;

//===========================================================

app.get('/startcall', (req, res) => {

  res.status(200).send('Ok');

  let hostName;

  if (neruHost) {
    hostName = neruHost;
  } else {
    hostName = req.hostname;
  }

  // WebSocket connection
  const wsUri = 'wss://' + processorServer + '/socket'; 
  
  console.log('>>> websocket URI:', wsUri);

  // create first websocket leg
  vonage.calls.create({
    to: [{
      type: 'websocket',
      uri: wsUri,
      'content-type': 'audio/l16;rate=16000',  // NEVER change the content-type parameter argument
      headers: {}
    }],
    from: {
      type: 'phone',
      number: 19999999999 // cannot use a longer than 15-digit string (e.g. not call_uuid)
    },
    answer_url: ['https://' + hostName + '/ws_answer?callee_number=' + calleeNumber1],
    answer_method: 'GET',
    event_url: ['https://' + hostName + '/ws_event?callee_number=' + calleeNumber1],
    event_method: 'POST'
    }, (err, res) => {
    if(err) {
      console.error(">>> websocket create error:", err);
      // console.error(err.body.title);
      // console.error(err.body.invalid_parameters);
      }
    else { console.log(">>> websocket create status:", res); }
  });

});  

//------------

app.get('/ws_answer', (req, res) => {
  
  const nccoResponse = [
    {
      "action": "conversation",
      "name": "conf_" + req.query.uuid,
      "startOnEnter": true
    }
  ];

  res.status(200).json(nccoResponse);

 });

//------------

app.post('/ws_event', (req, res) => {

  res.status(200).send('Ok');

  const uuid = req.body.uuid;

  //-- make call to PSTN
  
  if (req.body.type == 'transfer') {

    let hostName;

    if (neruHost) {
      hostName = neruHost;
    } else {
      hostName = req.hostname;
    }

    //---

    vonage.calls.create({
      to: [{
        type: 'phone',
        number: calleeNumber1
      }],
      from: {
       type: 'phone',
       number: servicePhoneNumber
      },
      answer_url: ['https://' + hostName + '/answer1?original_uuid=' + uuid],
      answer_method: 'GET',
      event_url: ['https://' + hostName + '/event1?original_uuid=' + uuid],
      event_method: 'POST'
      }, (err, res) => {
      if(err) {
        console.error(">>> outgoing call error:", err);
        console.error(err.body.title);
        console.error(err.body.invalid_parameters);
      } else {
        console.log(">>> outgoing call status:", res);
      }
    });

  };

});

//------------

app.get('/answer1', (req, res) => {

  let hostName;

  if (neruHost) {
    hostName = neruHost;
  } else {
    hostName = req.hostname;
  }

  const uuid = req.query.uuid;
  const wsUuid = req.query.original_uuid;

  const nccoResponse = [
    {
      "action": "conversation",
      "name": "conf_" + wsUuid,
      "startOnEnter": true,
      "endOnExit": true
    }
  ];

  res.status(200).json(nccoResponse);

});

//------------

app.post('/event1', (req, res) => {

  res.status(200).send('Ok');

  let hostName;

  if (neruHost) {
    hostName = neruHost;
  } else {
    hostName = req.hostname;
  }

  const originalUuid = req.query.original_uuid;

  const uuid = req.body.uuid;

  if (req.body.type == 'transfer') {

    const dtmfDigits = 1;

    // send DTMF via WebSocket to indicate first PSTN participant just answered call

    console.log('\n\n>>> At timestamp', Date.now(), 'send DTMF request from Voice API application\n\n');

    vonage.calls.dtmf.send(originalUuid,
      { 
        digits: dtmfDigits
      }, 
      (err, res) => {
         if (err) { console.error('Send DTMF on WebSocket leg', originalUuid, 'error: ', err, err.body.invalid_parameters); }
         else {
           console.log('Send DTMF on WebSocket leg ', originalUuid, 'status: ', res);
      }
    });

    //--- The following action simulates what happens after the initial interaction between voice bot and first participant 

    const simulatedDelay = 6000;
    const simulatedAnnouncementDuration = 5000;

    //-- announcement to first participant  
    setTimeout(() => {

      vonage.calls.talk.start(uuid,  
        {
        text: "Please wait while we are connecting your call to a representative",
        language: 'en-US', 
        style: 0,
        }, (err, res) => {
           if (err) { console.error('Talk ', uuid, 'error: ', err, err.body.invalid_parameters); }
           else {
             console.log('Talk ', uuid, 'status: ', res);
        }
      });

    }, simulatedDelay);

    //-- play MoH to first participant (after announcement has played)
    setTimeout(() => {    

      vonage.calls.stream.start(uuid,
        {
          // IMPORTANT!!! FOR YOUR APPLICATION YOU MUST REPLACE THIS AUDIO FILE URL WITH YOURS
          stream_url: ['https://ccrma.stanford.edu/~jos/mp3/pno-cs.mp3'], // you ** MUST ** replace this placeholder URL with an audio file URL you have license or legal usage rights
          // stream_url: ['http://client-sdk-cdn-files.s3.us-east-2.amazonaws.com/us.mp3'], // ring back tone as music on hold
          loop: 0
        }, (err, res) => {
         if (err) { console.error('Stream ', uuid, 'leg error: ', err); }
         else { console.log('Stream ', uuid, 'leg status: ', res); }
      });

      //-- call second participant (to be dropped into same named conference)
      vonage.calls.create({
        to: [{
          type: 'phone',
          number: calleeNumber2
        }],
        from: {
         type: 'phone',
         number: servicePhoneNumber
        },
        answer_url: ['https://' + hostName + '/answer2?original_uuid=' + originalUuid + '&participant_one_uuid=' + uuid],
        answer_method: 'GET',
        event_url: ['https://' + hostName + '/event2?original_uuid=' + originalUuid + '&participant_one_uuid=' + uuid],
        event_method: 'POST'
        }, (err, res) => {
        if(err) {
          console.error(">>> outgoing call error:", err);
          console.error(err.body.title);
          console.error(err.body.invalid_parameters);
        } else {
          console.log(">>> outgoing call status:", res);
        }
      });

      //---

    }, simulatedDelay + simulatedAnnouncementDuration); 

  }

});

//------------

app.get('/answer2', (req, res) => {

  const uuid = req.query.uuid;
  const participantOneUuid = req.query.participant_one_uuid;

  const nccoResponse = [
    {
      "action": "conversation",
      "name": "conf_" + req.query.original_uuid,
      "startOnEnter": true,
      "endOnExit": true
    }
  ];

  res.status(200).json(nccoResponse);

  //-- Simulate end of initial interaction between 2nd participant and voice bot, then stop MoH to 1st participant
  
  const simulatedDelay = 5000;
  const simulatedAnnouncementDuration = 2000;

  setTimeout( () => { // announcement to 

    vonage.calls.talk.start(uuid,  
        {
        text: "You are now speaking to the customer",
        language: 'en-US', 
        style: 0,
        }, (err, res) => {
           if (err) { console.error('Talk ', uuid, 'error: ', err, err.body.invalid_parameters); }
           else {
             console.log('Talk ', uuid, 'status: ', res);
        }
      });

  }, simulatedDelay);


  setTimeout( () => {

    vonage.calls.stream.stop(participantOneUuid,
      (err, res) => {
        if (err) { console.error('Stream stop ', participantOneUuid, 'leg error: ', err); }
        else { console.log('Stream stop', participantOneUuid, 'leg status: ', res); }
    })

  }, simulatedDelay + simulatedAnnouncementDuration);

  //-- Now both participants can speak to each other, and the voice bot can hear/speak to both particioants via the WebSocket

 });

//------------

app.post('/event2', (req, res) => {

  res.status(200).send('Ok');

});

//--- If this application is hosted on Vonage serverless infrastructure (aka VCR - Vonage Code Runtime, aka Neru) --------

app.get('/_/health', async (req, res) => {

  res.status(200).send('Ok');

});

//=========================================

const port = process.env.NERU_APP_PORT || process.env.PORT || 8000;

app.listen(port, () => console.log(`Server application listening on port ${port}!`));

//------------
