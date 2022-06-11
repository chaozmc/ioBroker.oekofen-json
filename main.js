"use strict";

const utils = require("@iobroker/adapter-core");
const { type } = require("os");
const axios = require("axios").default;
let url = "";
let updateDataInterval;
let timeout1;
let deadManSwitch;

class OekofenJson extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "oekofen-json",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:

		this.log.info("OekoFEN IP: " + this.config.oekofenIp);
		this.log.info("OekoFEN Port: " + this.config.oekofenPort);
		this.log.info("OekoFEN Passwort: " + this.config.oekofenPassword);
		this.log.info("Request Interval: " + this.config.myRequestInterval);


		url = "http://" + this.config.oekofenIp + ":" + this.config.oekofenPort + "/" + this.config.oekofenPassword;

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/

		//////////////// Create Objects ///////////////////////////
		///////////////////////////////////////////////////////////


		/************************************************
		 * Here we create the connection-state variable *
		*************************************************/
		await this.setObjectNotExistsAsync("info.connection", {
			type: "state",
			common: {
				name: "connection",
				type: "boolean",
				role: "indicator",
				desc: "Test",
				read: true,
				write: true,
			},
			native: {},
		});



		///////////////////////////////////////////////////////////
		///////////////////////////////////////////////////////////

		//updateDataInterval = setInterval(async () => await this.updateData(url), Number.parseInt(this.config.myRequestInterval)*1000);
		timeout1 = setTimeout(async() => await this.initialScan(url), 10000);
		deadManSwitch = setInterval(async() => await this.heartbeat(), Number.parseInt(this.config.myRequestInterval)*2000);
		//await this.initialScan(url);
		this.setStateAsync("info.connection", { val: false, ack: true });




		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		//this.subscribeStates("testVariable");
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates("lights.*");
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates("*");

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		//await this.setStateAsync("testVariable", true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		//await this.setStateAsync("testVariable", { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		//await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		// let result = await this.checkPasswordAsync("admin", "iobroker");
		// this.log.info("check user admin pw iobroker: " + result);

		// result = await this.checkGroupAsync("admin", "admin");
		// this.log.info("check group user admin group admin: " + result);
	}

	async heartbeat() {
		this.setStateAsync("info.connection", { val: false, ack: true });
	}

	/**
	 * @param {string} url
	 */
	async initialScan(url) {
		await axios.get(url + "/all??", { responseEncoding: "latin1" })
			.then(response => {
				Object.keys(response.data).forEach(key => {
					Object.keys(response.data[key]).forEach(innerKey => {
						let objType;
						let objStates;
						if (typeof response.data[key][innerKey].val === "number") {
							if (response.data[key][innerKey].format === undefined) {
								objType = "number";
							} else {
								objType = "number";
								const input = response.data[key][innerKey].format;
								const firstDelimiter = "|";
								const secondDelimiter = ":";
								const cleanInput = input.replace(/#./g, "|");
								const output = cleanInput.split(firstDelimiter).reduce( (newArr, element, i) => {
									let subArr = element.split(secondDelimiter);
									newArr[i] = subArr;

									return newArr;

								}, []);
								objStates = Object.fromEntries(output);
							}
						} else if(typeof response.data[key][innerKey].val === "string") {
							objType = "string";
						} else if(response.data[key][innerKey].val === undefined) {
							objType = "string";
						} else {
							objType = "mixed";
						}

						this.log.info(innerKey + ": " + objType);
						this.setObjectNotExistsAsync(key + "." + innerKey, {
							type: "state",
							common: {
								name: innerKey,
								type: objType,
								role: "state",
								desc: "TestDescription",
								read: true,
								write: (innerKey.startsWith("L_") ? false : true),
								states: objStates
							},
							native: {
								factor: response.data[key][innerKey].factor //abn
							}
						});
						try {
							if(response.data[key][innerKey].val === undefined) {
								this.setStateAsync(key + "." + innerKey, { val: response.data[key][innerKey].toString(), ack: true });
							} else if (typeof response.data[key][innerKey].val === "number"){
								this.setStateAsync(key + "." + innerKey, { val: response.data[key][innerKey].val, ack: true });
							} else if (typeof response.data[key][innerKey].val === "string") {
								this.setStateAsync(key + "." + innerKey, { val: response.data[key][innerKey].val.toString(), ack: true });
							}

						} catch (error) {
							this.log.info("Error : "+ error);
						}

						//this.log.info(response.data[key][innerKey]);iwas
						//this.log.info(response.data[key][innerKey]);
					});
				});
				//Set connection to true, if get-request was successful
				this.setStateAsync("info.connection", { val: true, ack: true });
			})
			.catch(error => {
				this.log.error(error);
				//Set connection to false in case of errors
				this.setStateAsync("info.connection", { val: false, ack: true });
			});
	}

	/**
	 * @param {string} url
	 */
	async updateData(url) {

		axios.get(url, { responseEncoding: "latin1" })
			.then(response => {
				this.log.info(response.data.datetime);
				this.setStateAsync("datum", { val: response.data.datetime, ack: true });
				this.log.info(response.data.abbreviation);
				this.setStateAsync("zeitzone", { val: response.data.abbreviation, ack: true });
			})
			.catch(error => {
				this.log.error(error);
			});

	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);

			clearTimeout(timeout1);
			clearInterval(updateDataInterval);
			clearInterval(deadManSwitch);
			this.setStateAsync("info.connection", { val: false, ack: true });

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }

}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new OekofenJson(options);
} else {
	// otherwise start the instance directly
	new OekofenJson();
}