# Older changes
## 1.0.0 (2023-01-15)
* (chaozmc) Push version to v1.0.0 as the code seems to be considerable as first stable release

## 0.3.0 (2023-01-15)
* (chaozmc) Changed Adapter Type to more suitable climate-control instead of communication
* (chaozmc) Altered query URL for inital scan to use single ?-symbol instead of double

## 0.2.5 (2022-11-18) 
* (chaozmc) Removed unnecessary const

## 0.2.4 (2022-10-31) 
* (chaozmc) changed loop behaviour to use a for...of loop instead of forEach to avoid parallel creation of too many objects at startup

## 0.2.3 (2022-10-29) 
* (chaozmc) changed initialScan function to use createObjectNotExistsAsync instead

## 0.2.2 (2022-08-15) 
* (chaozmc) changed objects-creation and value-updates to async/await

## 0.2.1 (2022-08-15) 
* (chaozmc) clear interval on triggered update - fixes #10
* (chaozmc) rewrite update & initialScan - fixes #11 and #12
* (chaozmc) store password encrypted - fixes #14
* (chaozmc) create static objects via io-package.json - fixes #13

## 0.2.0 (2022-07-24)
* (chaozmc) Update README, prepare for first stable release
* (chaozmc) Fix Objects with min/max null value (Issue #8)
* (chaozmc) Removed selectable encoding
* (chaozmc) Added v3.10d compatibility

## 0.2.0-beta.0 (2022-07-03)
* (chaozmc) update to admin v5 config and require min version of admin (>= 5.2.0)

## 0.1.0-beta.0 (2022-06-26)
* (chaozmc) selectable response encoding (utf8 & latin1) & bit of debug-logging added
