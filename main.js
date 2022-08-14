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
		this.log.debug("[onReady] Generated URL for requests: " + url);


		//create the connection-state variable
		this.log.debug("[onReady] create connection datapoint");
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

		// //create a rescan state which will trigger a complete rescan of all datapoints, like it's done on adapter load
		// this.log.debug("[onReady] create rescan datapoint");
		// await this.setObjectNotExistsAsync("info.rescan", {
		// 	type: "state",
		// 	common: {
		// 		name: "rescan",
		// 		type: "boolean",
		// 		role: "button",
		// 		desc: "Rescan JSON and create (missing) datapoints",
		// 		read: true,
		// 		write: true,
		// 	},
		// 	native: {},
		// });




		// //create an update state, which will trigger an update of all datapoints
		// this.log.debug("[onReady] create update datapoint");
		// await this.setObjectNotExistsAsync("info.update", {
		// 	type: "state",
		// 	common: {
		// 		name: "update",
		// 		type: "boolean",
		// 		role: "button",
		// 		desc: "Trigger an update of all states now",
		// 		read: true,
		// 		write: true,
		// 	},
		// 	native: {},
		// });


		this.log.debug("[onReady] subscribed to rescan datapoint");
		this.subscribeStates("info.rescan");

		this.log.debug("[onReady] subscribed to update datapoint");
		this.subscribeStates("info.update");

		this.log.debug("[onReady] info.rescan value set to false");
		await this.setStateAsync("info.rescan", false, true);

		this.log.debug("[onReady] info.update set to false");
		await this.setStateAsync("info.update", false, true);


		//Initiate a delay between Adapter-StartUp and the first connection attempt to OekoFEN
		this.log.debug("[onReady] created timeout for 1st scan");
		timeout1Scan = setTimeout(async() => await this.initialScan(url), 10000);

		//Initialize the connection state with value false; it will be set to true after first successful webrequest
		this.log.debug("[onReady] set info.connection to initial false");
		this.setStateAsync("info.connection", { val: false, ack: true });
	}



	/**
	 * @param {string} url
	 */
	async initialScan(url) {
		this.log.debug("[initialScan] called with url: " + url + " and encoding: latin1");
		try {
			const response = await axios.get(url + "/all??", { responseEncoding: "latin1" });
			if (response.status === 200) {
				this.log.debug("[initialScan_axios.get] got HTTP/200 response, call parseDataOnStartupAndCreateObjects with response.data");
				this.parseDataOnStartupAndCreateObjects(response.data);
				//Set connection to true, if get-request was successful
				this.log.debug("[initialScan_axios.get] set info.connection to true as request was successful");
				this.setStateAsync("info.connection", { val: true, ack: true });
				this.log.debug("[initialScan] set updateDataInterval to " + Number.parseInt(this.config.myRequestInterval)*1000);
				updateDataInterval = setInterval(async () => await this.updateData(url), Number.parseInt(this.config.myRequestInterval)*1000);
			} else {
				throw "axios response code " + response.status;
			}
		} catch (error) {
			this.log.error("[initialScan_axios.get.catch] " + error + " - Adapter exiting now.");
			//Set connection to false in case of errors
			this.log.debug("[initialScan_axios.get.catch] error while initial request has occured, disable adapter.");
			this.setStateAsync("info.connection", { val: false, ack: true });
			this.disable();
			return;
		}
	}

	/**
	 * @param {string} url
	 */
	async updateData(url) {
		this.log.debug("[updateData] called with url: " + url + " and encoding: latin1");
		//for a normale update, we'll use the normal /all path, this will reduce transmitted data to about half the size
		try {
			const response = await axios.get(url + "/all", { responseEncoding: "latin1" });
			if (response.status === 200) {
				this.log.debug("[updateData_axios.get] got HTTP/200 response, call parseDataAndSetValues with response.data");
				this.parseDataAndSetValues(response.data, this);
				//Set connection to true, if get-request was successful
				this.log.debug("[updateData_axios.get] set info.connection to true as request was successful");
				this.setStateAsync("info.connection", { val: true, ack: true });
			} else {
				throw "axios response code " + response.status;
			}
		} catch (error) {
			this.log.error("[updateData_axios.get.catch] " + error);
			//Set connection to false in case of errors
			this.log.debug("[updateData_axios.get.catch] error while request has occured, setting info.connection to false");
			this.setStateAsync("info.connection", { val: false, ack: true });
		}
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
				let objMin;
				let objMax;
				let objFactor;
				let objUnit;
				//try to find out, how the datapoint looks like
				//For v3.10d try to find out if the current datapoint maybe is a wrongly stringified Number
				if ((innerKey !== "name") && ((typeof jsonData[key][innerKey].val === "number") || !isNaN(Number(jsonData[key][innerKey].val)))) {
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
				} else if(typeof jsonData[key][innerKey].val === "string" || innerKey === "name") {
					objType = "string";
				} else if(jsonData[key][innerKey].val === undefined) {
					objType = "string";
				} else {
					objType = "mixed";
				}

				if (jsonData[key][innerKey].factor)
				{
					objFactor = Number(jsonData[key][innerKey].factor);
				} else {
					objFactor = undefined;
				}

				if (jsonData[key][innerKey].min) {
					if(objFactor) {
						objMin = Number(jsonData[key][innerKey].min) * objFactor;
					} else {
						objMin = Number(jsonData[key][innerKey].min);
					}
				} else {
					objMin = undefined;
				}

				if (jsonData[key][innerKey].max) {
					if(objFactor) {
						objMax = Number(jsonData[key][innerKey].max) * objFactor;
					} else {
						objMax = Number(jsonData[key][innerKey].max);
					}
				} else {
					objMax = undefined;
				}

				if (jsonData[key][innerKey].unit) {
					if (jsonData[key][innerKey].unit === "?C")
					{
						objUnit = "°C";
					} else {
						objUnit = jsonData[key][innerKey].unit;
					}

				} else {
					objUnit = undefined;
				}


				//As v3.10d sends everything as string, convert everything which could be a number to a number.
				//In later versions, Number(aNumber) should just return itself
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
							min: objMin,
							max: objMax,
							unit: objUnit
						},
						native: {
							factor: objFactor
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
						let tNewVal;

						// Find out which datatype the object in iobroker is and convert the value
						if (obj.common.type === "number") {
							tNewVal = Number(jsonData[key][innerKey]);
						} else if (obj.common.type === "string") {
							tNewVal = String(jsonData[key][innerKey]);
						} else {
							throw("Datapoint (" + key + "." + innerKey + ") is without type. Data won't get updatet!");
						}

						if (obj && obj.native.factor) {
							instanceObject.setStateAsync(key + "." + innerKey, {val: tNewVal * obj.native.factor, ack: true});
						} else {
							instanceObject.setStateAsync(key + "." + innerKey, {val: tNewVal, ack: true});
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
			clearInterval(updateDataInterval);
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
			if (res.status === 200) {
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