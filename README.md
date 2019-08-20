## Amazon Pinpoint Call Generator
Use Amazon Web Services (AWS) Pinpoint, Lambda and Connect to transparently put customers into a phone callback queue upon an SMS request from them.

## License Summary
This sample code and flow is made available under Open Source - MIT No Attribution License (MIT-0). See the [LICENSE](/LICENSE) file.

### Architecture
Upon an SMS request from the user, AWS Pinpoint publishes to AWS SNS queue. A custom AWS Lambda function detects a new event, confirms configured keyword was part of the request and commands AWS Connect to issue a Call-out to another AWS Connect number (i.e. behind the scenes) and a custom AWS Connect Flow at that point configures the Callback queue and the Callback phone number to use. As all of this occurs behind the scenes, user remains unaware of the details and does not have to remain on the line - they receive a call once the next available Agent is already on the line.

Major benefits:
1. Customer does not wait on the line (nor consumes the line)
2. Customer is put immediately into the queue (following the standard FIFO)
3. Customer gets immediate confirmation that they have been put into the queue
4. All of the flows are asynchronous/independent of each other
5. Limited only by the configured Callback queue (no intrinsic volume limit)
6. Provides for full native visibility (including wait-times)

![Architecture Diagram](misc/architecture.png?raw=true)

### Prerequisites
This flow requires that you have an AWS Account with AWS Pinpoint project and AWS Connect instance set up. 
No extra configuration is required - you can start right out of the gate.

### Repository content
Main files:
```bash
.
├── README.MD                   <-- This instructions file
├── ExecutionRole.json          <-- Sample IAM policy (also part of the SAM template). Make sure to edit manually first!
├── src                         <-- Source code for a lambda function
│   └── app.js                  <-- Lambda function code
│   └── connectFlow.json        <-- Connect flow export flow for programmatic callback. Make sure to edit manually first!
│   └── package.json            <-- NodeJS dependencies and scripts
│   └── tests                   <-- Unit tests
│       └── unit
│           └── eventData.json  <-- Sample payload that mimics the SMS received from customer (from Pinpoint via SNS). Make sure to edit manually first!
├── template.yaml               <-- SAM template. Make sure to edit manually first!
```

### Setup
#### Step 1: Pinpoint
Create the new Pinpoint project or identify one you want to reuse along with the long-code. 
Setup two-way SMS. Take note of the SNS topic (new or existing). 
If this number will be used for outgoing notifications, make sure you handle unsubscribe (aka STOP) requests.
Optionally add a temporary email subscription to the SNS topic to passively and proactively monitor it during debugging.
Send SMS through and confirm SNS event occurs.
#### Step 2: Connect
Create the new Connect instance or identify the one you want to reuse along with the phone number(s). 
Optionally setup new basic Connect queue for Callback and another one for Callback routing if you want to use a separate number for that.
Create new flow to push new callback requests. Use /src/connectFlow.js as a reference, if needed:
![Connect Callback flow Diagram](misc/ConnectCallBackFlow.png?raw=true)
The main portions of the flow is the _Set callback number_ set to "callbacknumber" attribute (no quotes) and following it _Transfer to queue_ set to _Transfer to callback queue_ with the appropriate queue selected.
#### Step 3: Permissions/IAM
Add new Lambda execution role with limited permissions to Pinpoint (to respond to the customer), Connect (to actually place customer's phone number into the queue), and CloudWatch Logs (for basic logging and debugging). 
Feel free to either reuse ExecutionRole.json provided or copy YAML portion from template.yaml if you prefer.
Remember that AWS Policies are always designed to only allow what is absolutely necessary. As you expand your application, you may need to add new (or remove) resources and functions you intend to call. You may also want to add X-Ray permissions down the line for full tracing support.
#### Step 4: Lambda
Add the new Lambda function (either upload the included Lambda directly or copy-paste).
Set Environment variables - these are dynamic configuration parameters that you will be able to switch/change in production.
Associate Lambda with SNS. 
Save.
Configure a new Lambda Test event - use included eventData.json for the sample payload, but remember to change the phone number.
#### Step 5: Run and Confirm
Run test and confirm your event produces the SMS back to the number you specified or check console for errors.
Send a manual SMS to your Pinpoint number and confirm your event goes through SNS and you receive another response via SMS.
Go to Connect, Analytics, Real-Time, Queues and confirm the callback queue numbers increased based on your requests (there should be at least 2 now, 1 from the Lambda test, 1 from the last SMS one). Note that the number may take a short while (several minutes) to update, depending on your setup.