"use strict";

const utils = require("@iobroker/adapter-core");
const { debug } = require("console");
const { type } = require("os");
const { toNamespacedPath } = require("path");
const axios = require("axios").default;
let url = "";
let updateDataInterval;
let timeout1;
let deadManSwitch;
// let tempObjStore;

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
		this.on("stateChange", this.onStateChange.bind(this), this);
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {

		this.log.info("OekoFEN IP: " + this.config.oekofenIp);
		this.log.info("OekoFEN Port: " + this.config.oekofenPort);
		this.log.info("OekoFEN Passwort: " + this.config.oekofenPassword);
		this.log.info("Request Interval: " + this.config.myRequestInterval);

		url = "http://" + this.config.oekofenIp + ":" + this.config.oekofenPort + "/" + this.config.oekofenPassword;

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
				this.parseDataOnStartupAndCreateObjects(response.data);
				//Set connection to true, if get-request was successful
				this.setStateAsync("info.connection", { val: true, ack: true });
			})
			.catch(error => {
				this.log.error(error);
				//Set connection to false in case of errors
				this.setStateAsync("info.connection", { val: false, ack: true });
			});
		updateDataInterval = setInterval(async () => await this.updateData(url), Number.parseInt(this.config.myRequestInterval)*1000);
	}

	/**
	 * @param {string} url
	 */
	async updateData(url) {

		axios.get(url + "/all", { responseEncoding: "latin1" })
			.then(response => {
				this.parseDataAndSetValues(response.data, this);
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
	 * @param {object} jsonData
	 */
	parseDataOnStartupAndCreateObjects(jsonData) {
		Object.keys(jsonData).forEach(key => {
			Object.keys(jsonData[key]).forEach(innerKey => {
				let objType;
				let objStates;
				if (typeof jsonData[key][innerKey].val === "number") {
					if (jsonData[key][innerKey].format === undefined) {
						objType = "number";
					} else {
						objType = "number";
						const input = jsonData[key][innerKey].format;
						const firstDelimiter = "|";
						const secondDelimiter = ":";
						const cleanInput = input.replace(/#./g, "|");
						const output = cleanInput.split(firstDelimiter).reduce( (/** @type {{ [x: string]: any; }} */ newArr, /** @type {string} */ element, /** @type {string | number} */ i) => {
							const subArr = element.split(secondDelimiter);
							newArr[i] = subArr;

							return newArr;

						}, []);
						objStates = Object.fromEntries(output);
					}
				} else if(typeof jsonData[key][innerKey].val === "string") {
					objType = "string";
				} else if(jsonData[key][innerKey].val === undefined) {
					objType = "string";
				} else {
					objType = "mixed";
				}

				if (!innerKey.endsWith("_info")) {
					this.setObjectNotExists(key + "." + innerKey, {
						type: "state",
						common: {
							name: innerKey,
							type: objType,
							role: "state",
							read: true,
							write: (innerKey.startsWith("L_") ? false : true),
							states: objStates,
							min: (jsonData[key][innerKey].factor && jsonData[key][innerKey].factor != 1 ? (jsonData[key][innerKey].min * jsonData[key][innerKey].factor) : jsonData[key][innerKey].min ) ,
							max: (jsonData[key][innerKey].factor && jsonData[key][innerKey].factor != 1 ? (jsonData[key][innerKey].max * jsonData[key][innerKey].factor) : jsonData[key][innerKey].max ) ,
							unit: jsonData[key][innerKey].unit
						},
						native: {
							factor: jsonData[key][innerKey].factor
						}
					});

					if (!innerKey.startsWith("L_")) { this.subscribeStates(key + "." + innerKey); }

				}
			});

		});
	}

	/**
	 * @param {object} jsonData
	 * @param {object} instanceObject
	 */
	parseDataAndSetValues(jsonData, instanceObject) {
		Object.keys(jsonData).forEach(key => {
			Object.keys(jsonData[key]).forEach(innerKey => {
				try {

					this.getObject(key + "." + innerKey, function(err, obj) {
						if (obj && obj.native.factor) {
							instanceObject.setStateAsync(key + "." + innerKey, {val: jsonData[key][innerKey] * obj.native.factor, ack: true});
						} else {
							instanceObject.setStateAsync(key + "." + innerKey, {val: jsonData[key][innerKey], ack: true});
						}
					});

					// if(typeof jsonData[key][innerKey] === "string")
					// if(jsonData[key][innerKey].val === undefined) {
					// 	this.setState(key + "." + innerKey, { val: jsonData[key][innerKey].toString(), ack: true });
					// } else if (typeof jsonData[key][innerKey].val === "number"){
					// 	this.setState(key + "." + innerKey, { val: jsonData[key][innerKey].val, ack: true });
					// } else if (typeof jsonData[key][innerKey].val === "string") {
					// 	this.setState(key + "." + innerKey, { val: jsonData[key][innerKey].val.toString(), ack: true });
					// }

				} catch (error) {
					this.log.error("Error in function parseDataAndSetValues: "+ error);
					this.setState("info.connection", {val: false, ack: true});
				}
			});

		});


	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			clearTimeout(timeout1);
			clearInterval(updateDataInterval);
			clearInterval(deadManSwitch);
			this.setStateAsync("info.connection", { val: false, ack: true });

			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	async onStateChange(id, state) {
		if (state && !state.ack && state.val) {

			const dataPoint = await this.getObjectAsync(id);
			if (!dataPoint) {
				return "Error, DataPoint not found";
			}
			if (dataPoint.native.factor) {
				const realValue = Number.parseInt(state.val) / dataPoint.native.factor
				if (dataPoint.max) {
					const realMax = dataPoint.max / dataPoint.native.factor;
					if (realValue > realMax) {
						this.log.error("Value " + state.val + " for dataPoint " + id + "is bigger than allowed max (" + dataPoint.max +")");
						return "Error; Value bigger than maxVal";
					}
				}
				if (dataPoint.min) {
					const realMin = dataPoint.min / dataPoint.native.factor;
					if (realValue < realMin) {
						this.log.error("Value " + state.val + " for dataPoint " + id + "is smaller than allowed min (" + dataPoint.min +")");
						return "Error; Value smaller than minVal";
					}
				}
				if (await this.sendUpdateToOekofen(id, realValue)) {
					await this.setStateAsync(id, state.val, true);
				}

			} else {
				if (await this.sendUpdateToOekofen(id, state.val)) {
					await this.setStateAsync(id, state.val, true);
				}
			}

			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			//this.log.info(`state ${id} deleted`);
		}
	}



	/**
	 * @param {string} stateId
	 * @param {string | number} newValue
	 */
	async sendUpdateToOekofen(stateId, newValue) {
		const urlForUpdate = url + "/" + stateId.replace(this.namespace, "").substring(1) + "=" + newValue;
		console.log(urlForUpdate);
		try {
			const res = await axios.get(urlForUpdate, { responseEncoding: "latin1" });
			if (res.status === 200 && !res.data.startsWith("Failure")) {
				return true;
			} else {
				this.log.error("[sendUpdateToOekofen] Error while making Webrequest: Webserver sent Failure");
				return false;
			}
		} catch (error) {
			this.log.error("[sendUpdateToOekofen] Error while making Webrequest: " + error);
		}
		return false;
	}
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