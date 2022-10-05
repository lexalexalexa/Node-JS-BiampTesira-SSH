var net = require('net');

module.exports = function(RED) {
    function Laurent2ReceiverConfigNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

		// ----- global vars --- start ---------------------------------------------
		// end command string
		const END_STR = "\r\n";
		// get mic status command
		const M_STATUS = "mic_status";
		// status of connect: 0-disconnected, 1-connected
		var net_status = 0;
		// first time send data indicator
		var firstDataSend = 0;
		// timeout for reconnecting (setTimeout)
		var reconnectTimeout = null;
		// timeout for resubscribe (setInterval)
		var resubscribeTimeout = null;
		// node done indicator
		var done_active = 0;
		// rele status
		var rele_status = [{'value': null}, 
							{'value': null},
							{'value': null},
							{'value': null}];
		// input status
		var input_status = [{'value': null}, 
							{'value': null},
							{'value': null},
							{'value': null},
							{'value': null},
							{'value': null}];
		// pwm status
		var pwm_status = [{'value': 0}]
		// main device client
		var client = new net.Socket();

		// ----- global vars --- end   ---------------------------------------------
		
		// ----- events --- start --------------------------------------------------
		
		// event if can not connect to device
		client.on('error', function() {
			node.log('socket error');
			node.setStatus(0);
		});
		
		// event of closing connection
		client.on('close', function() {
			node.log('socket close');
			//node.setStatus(0);
		});
		
		// event of closing connection
		client.on('end', function() {
			node.log('socket end');
			node.setStatus(0);
		});
		
		// event of closing connection
		client.on('timeout', function() {
			node.log('socket timeout');
			node.setStatus(0);
		});
		
		// event on client conneted event
		client.on('connect', function() {
			node.log("Connected to Laurent device at " + config.host);
			node.setStatus(1);
		});
		
		// event on receiving data from device (parsing data)
		client.on('data', function(data) {
			data = data.toString();
			
			// password success -> subscribe data change and read
			var regex_rep_pass = /#PSW,SET,OK/g;
			if (regex_rep_pass.exec(data) !== null) {
				node.send("$KE,MSG,S,EIN,SET,ON");	// subscribe IN change (ON_EVENT)
				node.send("$KE,MSG,S,RELE,SET,ON");	// subscribe RELE change (ON_TIME - 1 sec)
				node.send("$KE,MSG,S,PWM,SET,ON");	// subscribe PWM change (ON_TIME - 1 sec)
			}
			
			// rele status
			var regex_rep_rele = /#M,RELE,(0|1)(0|1)(0|1)(0|1)/g;
			var rep;
			while((rep = regex_rep_rele.exec(data)) !== null) {
				for (var rele_status_index in Array.from({length: 4}, (x, i) => i)) {
					var rele_number = parseInt(rele_status_index)+1; // 1,2...
					var new_rele_value = parseInt(rep[rele_number]);
					if (rele_status[rele_status_index]['value'] != new_rele_value)
					{
						rele_status[rele_status_index]['value'] = new_rele_value;
						var laurentMsg = {
							raw: rep[0],
							host: config.host,
							name: config.name,
							commandType: "rele_state",
							channel: parseInt(rele_number),
							command: "rele_" + rele_number,
							value: new_rele_value
						};

						node.emit('rele_state_response', laurentMsg);
					}
				}
				
			}
			
			// pwm status
			var regex_rep_pwm = /#M,PWM,([0-9]{1,3})/g;
			while((rep = regex_rep_pwm.exec(data)) !== null) {
				var new_pwm_value = parseInt(rep[1]);
				if (pwm_status['value'] != new_pwm_value)
				{
					pwm_status['value'] = new_pwm_value;
					var laurentMsg = {
						raw: rep[0],
						host: config.host,
						name: config.name,
						commandType: "pwm_state",
						channel: 1,
						command: "pwm_1",
						value: new_pwm_value
					};

					node.emit('pwm_state_response', laurentMsg);
				}
			}
			
			// input status
			var regex_rep_input = /#M,EIN,([0-9]{1,2}),(0|1)/g;
			while((rep = regex_rep_input.exec(data)) !== null) {
				var input_number = parseInt(rep[1]);
				var new_input_value = parseInt(rep[2]);
				if (input_status[input_number-1]['value'] != new_input_value)
				{
					input_status[input_number-1]['value'] = new_input_value;
					var laurentMsg = {
						raw: rep[0],
						host: config.host,
						name: config.name,
						commandType: "input_state",
						channel: input_number,
						command: "input_" + input_number,
						value: new_input_value
					};

					node.emit('input_state_response', laurentMsg);
				}
			}
		});
		
		//end node (on redeploy stream of Node JS)
		node.on('close', function(done) {
			done_active = 1;
			//node.warn("Done start");
			if (reconnectTimeout !== null)
			{
				clearTimeout(reconnectTimeout);
			}
			clientStream = null;
			//client.resetAndDestroy();
			//client.end();
			//client.disconnect();
			client.destroy();
			//node.warn("Done finish");
			done_active = 0;
			done();
		});
		// ----- events --- end   --------------------------------------------------
		// ----- functions --- start -----------------------------------------------
		// init function
        node.initialize = function() {
			//node.warn('Start initialize...');
			//reconnectTimeout = setTimeout(node.connect, 20000);
			node.connect();
		}
		
		// function for sending data to device
        node.send = function(msg) {
			// send data to device socket
            client.write(msg + END_STR);
        };

		// function for connecting to device
        node.connect = function() {
			//if (client !== null) {
			//	client.destroy();
			//	client = new net.Socket();
			//	node.redefineSubscribes();
			//}
			// clear reconnect timer
			reconnectTimeout = null
			// if there are no active connection try to connect
			if (net_status == 0) {
				client.connect(config.port, config.host);
			}
        };
		
		// get device status
		node.resubscribe = function() {
			//node.warn("resubscribe");
			node.send(M_STATUS);
        };

		// setting status of connection and emitting event for other modules of node
        node.setStatus = function(status) {
			if (done_active == 0)
			{
				//node.warn("connection status: " + status);
				node.emit("status_change", status);
				net_status = status;
				// generating message between nodes
				var laurentMsg = {
					raw: 'connect: ' + status,
					host: config.host,
					name: config.name,
					commandType: "connect",
					channel: "",
					command: "",
					value: status + ""
				}
				// sending message to response node for generating in the js area
				node.emit('connect', laurentMsg);
				// run reconnect timeout if disconnected
				if (status == 0) {
					clientStream = null;
					//client.disconnect();
					client.end();
					//client.destroy();
					if (reconnectTimeout == null) {
						reconnectTimeout = setTimeout(node.connect, 2000);
						//reconnectTimeout = setTimeout(node.connect, 20000);
					}
					//if (resubscribeTimeout !== null) {
					//	clearInterval(resubscribeTimeout);
					//	resubscribeTimeout == null;
					//}
				}
				
				if (status == 1) {
					node.send("$KE,PSW,SET," + config.password);
					//setTimeout(node.resubscribe, 3000);
					//resubscribeTimeout = setInterval(node.resubscribe, 60000);
				}
			}
        };
		// ----- functions --- end   -----------------------------------------------
		
		// run initialize of node
		node.initialize();
    }
    RED.nodes.registerType("laurent2-receiver-config", Laurent2ReceiverConfigNode);
}
