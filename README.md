# Basic application using Vonage Voice API to connect PSTN calls with a WebSocket in a named conference

## Set up

Copy or rename .env-example to .env<br>
Update parameters in .env file<br>
Have Node.js installed on your system, this application has been tested with Node.js version 16.15<br>
Install node modules with the command "npm install"<br>
Start application with the command "node pstn-websocket"<br>
--
This Voice API application needs a WebSocket server middleware running the application named websocket-server.js)
from repository https://github.com/nexmo-se/websocket-server

## How this application works

1- Establish WebSocket, drop in a named conference<br>

2- Establish 1st outbound PSTN call

3a- Once 1st outbound PSTN call has been answered, drop into same named conference

3b- Immediately send a DTMF via the WebSocket so the middleware WebSocket server knows that the PSTN call is live, for example to play a greeting<br>
At the same time, in the other direction, this WebSocket receives audio from the PSTN call from the very beginning of the answered PSTN call

4- In actual application logic, the 1st participant (on the 1st PSTN call) interacts with the voice bot (served by the middleware WebSocket server)

5a- Establish 2nd outbound PSTN call

5b- Play music on hold (MoH) to 1st PSTN call leg

6- Once 2nd outbound PSTN call has been answered, drop into same named conference

7- In actual application logic, the 2nd participant (on the 2nd PSTN call) interacts with the voice bot (served by the middleware WebSocket server)

8a- Notify 2nd participant that call is now connected with 1st participant too

8b- Stop MoH on 1st PSTN call leg

8c- Both PSTN legs and the WebSocket leg are now in this 3-way conference call and can hear and speak to each other

## To trigger the first PSTN oubound call

From a web browser, access:</br>

https://<address_of_server_running_this_code>/startcall
