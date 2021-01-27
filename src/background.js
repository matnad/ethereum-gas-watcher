// Fetch gas data every minute
const delayInMinutes = 1/60
const periodInMinutes = 1
const URL_GASNOW = "https://www.gasnow.org/api/v3/gas/price?utm_source=:GasWatcherAddon"

browser.alarms.create("fetch_gasData", {
    delayInMinutes,
    periodInMinutes,
  }
)

browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "fetch_gasData") {
    fetchGasData()
  }
})

function fetchGasData() {
  fetch(URL_GASNOW).then(r => r.json()).then(resData => {
    const gasData = resData?.data
    const timestamp = gasData?.timestamp
    const gasPrices = {}
    Object.keys(gasData).map((k) => {
      if (k !== "timestamp"){
        gasPrices[k] = Math.round(parseInt(gasData[k]) * 1e-9)
      }
    })
    browser.storage.sync.set({"gasData": {gasPrices, timestamp}})
  })
}

// Update Badge when gas data or selected level is updated
SPEED_COLORS = {
  "rapid": "#00c718",
  "fast": "#ff7828",
  "standard": "#0060ff",
  "slow": "#9160f2",
}
function updateBadge(value, level) {
  browser.browserAction.setBadgeText({text: String(value)})
  browser.browserAction.setBadgeBackgroundColor({color: SPEED_COLORS[level]})
  browser.browserAction.setBadgeTextColor({color: "white"})
}

// Check if gas price target from an alert is met and send notification, then clear alert
function checkAndNotify() {
  browser.storage.local.get("alert").then(r => {
    const level = r?.alert?.level
    const targetGasPrice = r?.alert?.value
    if (Number.isInteger(targetGasPrice) && targetGasPrice > 0) {
      browser.storage.sync.get("gasData").then(r => {
        const currentGasPrice = r?.gasData?.gasPrices?.[level]
        if (currentGasPrice <= targetGasPrice) {
          browser.storage.local.set({"alert": {"level": null, "value": 0}})
          browser.notifications.create("gas-notification", {
            "type": "basic",
            "iconUrl": browser.runtime.getURL("../icons/icon32.png"),
            "title": "Ethereum Gas Watcher Notification",
            "message": `\nThe ${level} gas price is now ${currentGasPrice} gwei!\nYou set a notification for ${targetGasPrice} gwei.`
          })
        }
      })
    }
  })
}

// Listener to update the badge with level and gas price
browser.storage.onChanged.addListener((changes, area) => {
  checkAndNotify()
  if (area === "sync") {
    if ("gasData" in changes) {
      browser.storage.sync.get({"level": "standard"}).then(r => {
        const gasPrice = changes?.gasData?.newValue?.gasPrices?.[r?.level]
        if (gasPrice > 0) {
          updateBadge(gasPrice, r?.level)
        }
      })
    } else if ("level" in changes) {
      browser.storage.sync.get("gasData").then(r => {
        const gasPrice = r?.gasData?.gasPrices?.[changes?.level?.newValue]
        if (gasPrice > 0) {
          updateBadge(gasPrice, changes?.level?.newValue)
        }
      })
    }
  }
})
