module.exports = function(RED) {
    function Laurent2ResponseNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.receiver = RED.nodes.getNode(config.receiver);

        node.receiver.on('status_change', function(status) {
            if(status === 1) {
                node.status({fill:"green",shape:"dot",text:"connected"});
            } else {
                node.status({fill:"red",shape:"ring",text:"disconnected"});
            }
        });
		
		// send messsage about "rele_state_response" in js
        node.receiver.on('rele_state_response', function(rep) {
			var msg = {
				payload: rep
			};
            node.send(msg);
        });
		
		// send messsage about "pwm_state_response" in js
		node.receiver.on('pwm_state_response', function(rep) {
			var msg = {
				payload: rep
			};
            node.send(msg);
        });
		
		// send messsage about "input_state_response" in js
		node.receiver.on('input_state_response', function(rep) {
			var msg = {
				payload: rep
			};
            node.send(msg);
        });

		// send messsage about "connect" in js
		node.receiver.on('connect', function(rep) {
			var msg = {
				payload: rep
			};
            node.send(msg);
        });

    }

    RED.nodes.registerType("laurent2-response", Laurent2ResponseNode);
}
