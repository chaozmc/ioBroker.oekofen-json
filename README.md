![Logo](admin/oekofen-json.png)
# ioBroker.oekofen-json

[![NPM version](https://img.shields.io/npm/v/iobroker.oekofen-json.svg)](https://www.npmjs.com/package/iobroker.oekofen-json)
[![Downloads](https://img.shields.io/npm/dm/iobroker.oekofen-json.svg)](https://www.npmjs.com/package/iobroker.oekofen-json)
![Number of Installations](https://iobroker.live/badges/oekofen-json-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/oekofen-json-stable.svg)
[![Dependency Status](https://img.shields.io/david/chaozmc/iobroker.oekofen-json.svg)](https://david-dm.org/chaozmc/iobroker.oekofen-json)

[![NPM](https://nodei.co/npm/iobroker.oekofen-json.png?downloads=true)](https://nodei.co/npm/iobroker.oekofen-json/)

**Tests:** ![Test and Release](https://github.com/chaozmc/ioBroker.oekofen-json/workflows/Test%20and%20Release/badge.svg)

## oekofen-json adapter for ioBroker

Connect OekoFEN Pellematic via JSON to ioBroker
This adapter tries to read the full version of the heaters json interface and create the objects on the fly with correct settings.
Settings include the factor, min, max and unit (like celsius, ...). It also respects the read/write settings which the json interface supports. In case a datapoint name starts with L_ it will be created to read only in ioBroker. 

After installation, its just required to enter the IP, port, so-called password and the interval at which the adapter tries to pull the updates. 



## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS** 
-->

### **WORK IN PROGRESS**
* (chaozmc) selectable response encoding (utf8 & latin1) & bit of debug-logging added

### **0.0.3**
* (chaozmc) code cleanup, trigger for update & rescan

### **0.0.2**
* (chaozmc) first working release, fixed 0-value updates

### **0.0.1**
* (chaozmc) initial build phase, much try and error

## License
MIT License

Copyright (c) 2022 chaozmc <chaozmc@is-jo.org>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.