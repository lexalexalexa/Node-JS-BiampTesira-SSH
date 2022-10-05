module.exports = function(RED) {
    function LaurentRequestNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
		
		// get config node
        node.receiver = RED.nodes.getNode(config.receiver);

        node.receiver.on('status_change', function(status) {
            if(status === 1) {
                node.status({fill:"green",shape:"dot",text:"connected"});
            } else {
                node.status({fill:"red",shape:"ring",text:"disconnected"});
            }
        });

        node.sendLaurentReleSetMsg = function(laurentObject) {
            // Build msg
            var msg = "$KE," + laurentObject.commandType + "," + laurentObject.rele_number + "," + laurentObject.value;
            node.receiver.send(msg);
        }
		
		node.sendLaurentPWMSetMsg = function(laurentObject) {
            // Build msg
            var msg = "$KE," + laurentObject.commandType + ",SET," + laurentObject.value;
            node.receiver.send(msg);
        }

		// send message to config node for parsing
        node.on('input', function(msg, send, done) {
            var laurentObject;
            // If payload is an object
            if(msg.payload !== null && typeof msg.payload === 'object') {
                laurentObject = msg.payload; 
                // Is valid laurent object?
                if (laurentObject.commandType == 'REL') {
                    node.sendLaurentReleSetMsg(laurentObject); // msg.payload = {'commandType' : 'REL', 'rele_number' : <rele_number>, 'value': <0|1>}
                    if (done) done();
                    return;
				} else if (laurentObject.commandType == 'PWM') {
                    node.sendLaurentPWMSetMsg(laurentObject); // msg.payload = {'commandType' : 'PWM', 'value': <0-100>}
                    if (done) done();
                    return;
                } else {
					node.warn("No valid laurent object passed!");
                }
            }
			
            // Else throw error
            node.error("No valid configuration available!");
            if (done) done();
        });
    }

    RED.nodes.registerType("laurent2-request", LaurentRequestNode);
}
