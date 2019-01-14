function inject (bot) {
  bot.warps = []
  bot._client.on('D2GS_ASSIGNLVLWARP', ({ unitId, x, y, warpId }) => {
    bot.warps.push({ unitId, x, y, warpId })
  })

  bot.run = (x, y) => {
    bot._client.write('D2GS_RUNTOLOCATION', {
      xCoordinate: x,
      yCoordinate: y
    })
    bot.x = x
    bot.y = y
  }

  bot.runToWarp = () => {
    /*
    let warpDistance = 9999999
    let currentDistance = 0
    for (let i = 0; i < bot.warps.length; i++) {
      currentDistance = Math.sqrt(Math.pow(bot.warps[i].x - bot.x) + Math.pow(bot.warps[i].y - bot.y))
      if (currentDistance < warpDistance) {
        warpDistance = currentDistance
      }
    }
    */
    try {
      bot.run(bot.warps[bot.warps.length - 1].x, bot.warps[bot.warps.length - 1].y)
      bot.say(`Heading for the last warp`)
      bot._client.removeAllListeners('D2GS_PLAYERMOVE')
      bot.follow = false
      bot.say(`Follow off`)
    } catch (error) {
      bot.say('Can\'t find any warp')
    }
  }

  bot.takeWaypoint = (waypoint, level) => {
    bot._client.write('D2GS_RUNTOENTITY', {
      entityType: 2,
      entityId: waypoint
    })
    bot._client.write('D2GS_INTERACTWITHENTITY', {
      entityType: 2,
      entityId: waypoint
    })
    bot._client.write('D2GS_WAYPOINT', { // TODO: Handle the case where the bot aint got the wp
      waypointId: waypoint,
      unknown: 0,
      levelNumber: level
    })
    bot._client.once('D2GS_MAPREVEAL', ({ tileX, tileY, areaId }) => {
      bot.area = areaId
    })
  }

  // Tentative to do pathfinding by exploring all 4 corners of the map
  // The bot should stop when receiving assignlvlwarp from the next area
  const DirectionsEnum = Object.freeze({ 'left': 1, 'top': 2, 'right': 3, 'bottom': 4 })

  // This will return when the teleportation is done
  async function reachedPosition (predictedPosition) {
    return new Promise(resolve => {
      bot._client.once('D2GS_REASSIGNPLAYER', ({ x, y }) => {
        // We check if we properly reached the expected position with a small margin of error
        if (Math.abs(x - predictedPosition.x) < 5 || Math.abs(y - predictedPosition.y) < 5) {
          resolve(true) // Means we hit a corner
        }
      })
    })
  }

  // TODO: Return the path used, to get optimized latter
  async function reachedWarp (x, y, direction = DirectionsEnum.left) {
    bot._client.once('D2GS_ASSIGNLVLWARP', ({ x, y, warpId, id }) => {
      // if (id === bot.area + 1) { // Just checking if we got to the next area ...
      return { x, y, warpId, id }
      // }
    })
    // Reset the direction
    if (direction === DirectionsEnum.bottom) {
      direction = DirectionsEnum.left
    }
    let reachedCorner = false
    let predictedPosition = { x: bot.x, y: bot.y } // We use a variable to store the predicted position
    while (!reachedCorner) {
      if (direction === DirectionsEnum.left) {
        predictedPosition = { x: bot.x, y: bot.y + 20 }
      }
      if (direction === DirectionsEnum.top) {
        predictedPosition = { x: bot.x + 20, y: bot.y }
      }
      if (direction === DirectionsEnum.right) {
        predictedPosition = { x: bot.x, y: bot.y - 20 }
      }
      if (direction === DirectionsEnum.top) {
        predictedPosition = { x: bot.x - 20, y: bot.y }
      }
      bot.say(`Going ${direction}`)
      bot.say(`castSkillOnLocation at ${predictedPosition.x};${predictedPosition.y}`)
      bot.castSkillOnLocation(predictedPosition.x, predictedPosition.y, 53)
      reachedCorner = await reachedPosition(predictedPosition)
    }
    reachedWarp(bot.x, bot.y, direction++)
  }

  bot.pathFind = () => {
    bot.say('Looking for the next level !')
    const success = reachedWarp(bot.x, bot.y)
    bot.say(success ? 'Found the next level' : 'Could\'nt find the next level')
  }
}

module.exports = inject
