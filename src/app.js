/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const AWS = require('aws-sdk');
AWS.config.update({
    region: process.env.region
});

var ContactFlowId = process.env.ConnectContactFlowId;
var InstanceId = process.env.ConnectInstanceId;
var QueueId = process.env.ConnectQueueId;
var AppId = process.env.PinpointApplicationId;
var Keyword = process.env.Keyword.toLowerCase();
var FakeNumber = process.env.FakeNumber;

const connect = new AWS.Connect();
const pinpoint = new AWS.Pinpoint();

// eslint-disable-next-line no-unused-vars
exports.handler = (event, context) => {
    /*
    * Event info is sent via the SNS subscription: https://console.aws.amazon.com/sns/home
    * 
    * - ConnectContactFlowId, ConnectInstanceId, ConnectQueueId are specific to your Connect instance.
    * - PinpointApplicationId is your Pinpoint Project ID.
    * - Keyword is the filter keyword you want the customers to send via SMS to trigger the flow. 
    *       Alternatively you can filter via SNS subscription setting itself (loose visibility but minimize costs).
    * - FakeNumber is the number you want to be dialed for the handover. You can use your main Connect line or
    *       setup an independent temporary number that does not do any actual agent hand-over.
    */
    console.log('Received event: ' + event.Records[0].Sns.Message);
    var timestamp = event.Records[0].Sns.Timestamp;
    var message = JSON.parse(event.Records[0].Sns.Message);
    var originationNumber = message.originationNumber;
    var response = message.messageBody.toLowerCase();
    if (originationNumber.length == 10) {
        originationNumber = "+1" + originationNumber;
    }
    if (response.includes(Keyword) && validateUSNumber(originationNumber)) {
        issueCallBack(originationNumber, timestamp);
        sendConfirmation(originationNumber);
    }
}

function validateUSNumber(originationNumber) {
    var params = {
        NumberValidateRequest: {
            IsoCountryCode: 'US',
            PhoneNumber: originationNumber
        }
    };
    return pinpoint.phoneNumberValidate(params, function (err, data) {
        if (err) {
            console.log(err, err.stack);
        }
        else {
            if (data['NumberValidateResponse']['PhoneTypeCode'] != 3) {
                console.log("Legitimate #.");
                return true;
            }
            else {
                console.log("Received a phone number that is invalid for US (" + originationNumber + "). Cancelling flow!");
                console.log(data);
            }
        }
        return false;
    });
}

function sendConfirmation(originationNumber) {
    var paramsSMS = {
        ApplicationId: AppId,
        MessageRequest: {
            Addresses: {
                [originationNumber]: {
                    ChannelType: 'SMS'
                }
            },
            MessageConfiguration: {
                SMSMessage: {
                    Body: 'Your number has been added to the call queue!',
                    MessageType: "TRANSACTIONAL"
                }
            }
        }
    };
    pinpoint.sendMessages(paramsSMS, function (err, data) {
        if (err) {
            console.log("An error occurred.\n");
            console.log(err, err.stack);
        } else if (data['MessageResponse']['Result'][originationNumber]['DeliveryStatus'] != "SUCCESSFUL") {
            console.log("Failed to send SMS confirmation:");
            console.log(data['MessageResponse']['Result']);
        } else {
            console.log("Successfully confirmed the call back via SMS to " + originationNumber);
        }
    });
}

function issueCallBack(originationNumber, timestamp) {
    var paramsCall = {
        DestinationPhoneNumber: FakeNumber,
        ContactFlowId: ContactFlowId, //Callback
        InstanceId: InstanceId, //Basic Main
        QueueId: QueueId, //Basic Main
        Attributes: {
            'timestamp': timestamp,
            'callbacknumber': originationNumber
        }
    };
    connect.startOutboundVoiceContact(paramsCall, function (err, data) {
        if (err) {
            console.log("An error occurred.\n");
            console.log(err, err.stack);
        }
        else {
            console.log(data);
            console.log("Successfully issued call back to " + originationNumber);
        }
    });
}  
