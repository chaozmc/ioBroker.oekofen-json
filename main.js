"use strict";

const utils = require("@iobroker/adapter-core");
const axios = require("axios").default;
let url = "";
let updateDataInterval;
let timeout1Scan;

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
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {

		//Build our request URL
		url = "http://" + this.config.oekofenIp + ":" + this.config.oekofenPort + "/" + this.config.oekofenPassword;


		//create the connection-state variable
		await this.setObjectNotExistsAsync("info.connection", {
			type: "state",
			common: {
				name: "connection",
				type: "boolean",
				role: "indicator",
				desc: "Test",
				read: true,
				write: false,
			},
			native: {},
		});

		//create a rescan state which will trigger a complete rescan of all datapoints, like it's done on adapter load
		await this.setObjectNotExistsAsync("info.rescan", {
			type: "state",
			common: {
				name: "rescan",
				type: "boolean",
				role: "button",
				desc: "Rescan JSON and create (missing) datapoints",
				read: true,
				write: true,
			},
			native: {},
		});


		//create an update state, which will trigger an update of all datapoints 
		await this.setObjectNotExistsAsync("info.update", {
			type: "state",
			common: {
				name: "rescan",
				type: "boolean",
				role: "button",
				desc: "Trigger an update of all states now",
				read: true,
				write: true,
			},
			native: {},
		});

		this.subscribeStates("info.rescan");
		this.subscribeStates("info.update");
		await this.setStateAsync("info.rescan", false, true);
		await this.setStateAsync("info.update", false, true);

		//Initiate a delay between Adapter-StartUp and the first connection attempt to OekoFEN
		timeout1Scan = setTimeout(async() => await this.initialScan(url), 10000);

		//Initialize the connection state with value false; it will be set to true after first successful webrequest
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

		//for a normale update, we'll use the normal /all path, this will reduce transmitted data to about half the size
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
			//if we reach those top-level-keys, just skip them; e.g. weather-forecast as we not even can manipulate something here
			if (key === "forecast") {
				return;
			} else {
				//create the top-level-keys as channels
				this.setObjectNotExists(key, {
					type: "channel",
					common: {
						name: key,
						role: "channel",
					},
					native: {
					}
				});
			}


			//iterate through each child of the top-level-keys
			Object.keys(jsonData[key]).forEach(innerKey => {
				let objType;
				let objStates;
				//try to find out, how the datapoint looks like
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

				//ignore the info-datapoint; its useless for iobroker
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

					//subscribe only to writeable datapoints
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
			//if we reach those top-level-keys, just skip them; e.g. weather-forecast as we not even can manipulate something here
			if (key === "forecast") {return;}

			Object.keys(jsonData[key]).forEach(innerKey => {
				try {

					//get the object from ioBroker and find out if there's a factor which needs to be applied
					this.getObject(key + "." + innerKey, function(err, obj) {
						if (obj && obj.native.factor) {
							instanceObject.setStateAsync(key + "." + innerKey, {val: jsonData[key][innerKey] * obj.native.factor, ack: true});
						} else {
							instanceObject.setStateAsync(key + "." + innerKey, {val: jsonData[key][innerKey], ack: true});
						}
					});

				} catch (error) {
					//normally, we won't reach this code
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
			clearTimeout(timeout1Scan);
			clearInterval(updateDataInterval);
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
		//is the onStateChange called by update or rescan trigger?
		if (id === this.namespace + ".info.rescan" && !state.ack && state.val) {
			this.log.debug("Rescan of all datapoints initiated");
			await this.initialScan(url);
			await this.setStateAsync(id, false, true);
			return;
		}

		if (id === this.namespace + ".info.update" && !state.ack && state.val) {
			this.log.debug("Update of values initiated");
			await this.updateData(url);
			await this.setStateAsync(id, false, true);
			return;
		}


		if (state && !state.ack) {
			//to update the value on the remote-side, we'll need to check if there's a factor applied or min/max is defined
			//therefore we'll try to get the datapoint from ioBroker first
			const dataPoint = await this.getObjectAsync(id);
			if (!dataPoint) {
				this.log.error("Error, DataPoint " + id + "not found!");
				return "Error, DataPoint not found";
			}

			//check if this datapoint has a factor defined
			if (dataPoint.native.factor) {
				const realValue = Number.parseInt(state.val) / dataPoint.native.factor;
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

				//If everything worked till here, send the update to OekoFEN and only if we receive true, set the ack flag
				if (await this.sendUpdateToOekofen(id, realValue)) {
					this.log.debug(`state ${id} changed: value ${state.val} (realValue=${realValue}) (ack = ${state.ack})`);
					await this.setStateAsync(id, state.val, true);
				}

			} else {
				//So no factor is present, just send the update to OekoFEN and only if we receive true, set the ack flag
				if (await this.sendUpdateToOekofen(id, state.val)) {
					this.log.debug(`state ${id} changed: value ${state.val} (ack = ${state.ack})`);
					await this.setStateAsync(id, state.val, true);
				}
			}
		} else {
			//this.log.debug(`state ${id} deleted`);
		}
	}



	/**
	 * @param {string} stateId
	 * @param {string | number} newValue
	 */
	async sendUpdateToOekofen(stateId, newValue) {
		const urlForUpdate = url + "/" + stateId.replace(this.namespace, "").substring(1) + "=" + newValue;
		try {
			const res = await axios.get(urlForUpdate, { responseEncoding: "latin1" });
			if (res.status === 200 && !res.data.startsWith("Failure")) {
				return true;
			} else {
				this.log.error("[sendUpdateToOekofen] Error while making Webrequest: Webserver rejected request");
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