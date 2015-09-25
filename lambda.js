var request = require('request');
var _ = require('lodash');
var Q = require('q');
var moment = require('moment');

var mlbApi = 'http://gd2.mlb.com/components/game/mlb/';


// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
  try {

    /**
     * Uncomment this if statement and populate with your skill's application ID to
     * prevent someone else from configuring a skill that sends requests to this function.
     */
    /*
    if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app.[unique-value-here]") {
       context.fail("Invalid Application ID");
     }
    */

    if (event.session.new) {
      onSessionStarted({requestId: event.request.requestId}, event.session);
    }

    if (event.request.type === "LaunchRequest") {
      onLaunch(event.request,
           event.session,
           function callback(sessionAttributes, speechletResponse) {
            context.succeed(buildResponse(sessionAttributes, speechletResponse));
           });
    }  else if (event.request.type === "IntentRequest") {
      onIntent(event.request,
           event.session,
           function callback(sessionAttributes, speechletResponse) {
             context.succeed(buildResponse(sessionAttributes, speechletResponse));
           });
    } else if (event.request.type === "SessionEndedRequest") {
      onSessionEnded(event.request, event.session);
      context.succeed();
    }
  } catch (e) {
    context.fail("Exception: " + e);
  }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
  console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId
        + ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
  console.log("onLaunch requestId=" + launchRequest.requestId
        + ", sessionId=" + session.sessionId);

  // Dispatch to your skill's launch.
  getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
  console.log("onIntent requestId=" + intentRequest.requestId
        + ", sessionId=" + session.sessionId);

  var intent = intentRequest.intent,
    intentName = intentRequest.intent.name;

  // Dispatch to your skill's intent handlers
  if ("TeamIntent" === intentName) {
    findPitcher(intent, session, callback);
  } else {
    throw "Invalid intent";
  }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
  console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId
        + ", sessionId=" + session.sessionId);
  // Add cleanup logic here
}

// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
  // If we wanted to initialize the session to have some attributes we could add those here.
  var sessionAttributes = {};
  var cardTitle = "Welcome";
  var speechOutput = "What team would you like the starting pitcher for?";
  // If the user either does not reply to the welcome message or says something that is not
  // understood, they will be prompted again with this text.
  var repromptText = "What team would you like the starting pitcher for?";
  var shouldEndSession = false;

  callback(sessionAttributes,
       buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

/**
 * Sets the color in the session and prepares the speech to reply to the user.
 */
function findPitcher(intent, session, callback) {
  var cardTitle = intent.slots.Team.value + ' Starting Pitcher';
  var teamSlot = intent.slots.Team;
  var dateSlot = intent.slots.Date;
  var repromptText = "";
  var sessionAttributes = {};
  var shouldEndSession = true;
  var speechOutput = "";
  var date;
  if (dateSlot) {
    date = new Date(dateSlot.value);
  } else {
    date = new Date();
  }

  if (teamSlot) {
    getGame(teamSlot.value, date).then(function (game) {
      return getGameDetail(game, date);
    }, function (error) {
      var speechOutput = [
        'I can\'t find a game for the',
        teamSlot.value,
        getDateSpeech(date)
      ].join(' ');
      callback(sessionAttributes,
           buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
    }).then(function (gameDetail) {
      var speechOutput = generatePitcherSpeech(gameDetail, date);
      callback(sessionAttributes,
           buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
    }, function (error) {
      var speechOutput = [
        'I had trouble finding a starting pitcher for the',
        teamSlot.value,
        getDateSpeech(date)
      ].join(' ');
      callback(sessionAttributes,
           buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
    });
  }
}

function getDateSpeech(date) {
  var today = moment(new Date()).startOf('day');
  return moment(date).calendar(today, {
    sameDay: '[Today]',
    nextDay: '[Tomorrow]',
    nextWeek: '[on] dddd',
    lastDay: '[Yesterday]',
    lastWeek: '[Last] dddd'
  });
}

function getDateApiUrl(date) {
  var url = mlbApi +
    'year_' + date.getFullYear() +
    '/month_' + ('0' + (date.getMonth()+1)).slice(-2) +
    '/day_' + date.getDate() +
    '/';
  return url;
}

function getGame(team, date) {
  var deferred = Q.defer();
  var url = getDateApiUrl(date) + 'grid.json';
  request(url, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var json = JSON.parse(body);
      var game = _.find(json.data.games.game, function(game) {
        return team.toLowerCase() === game.home_team_name.toLowerCase() || team.toLowerCase() === game.away_team_name.toLowerCase();
      });
      if (game) {
        deferred.resolve(game);
      } else {
        deferred.reject();
      }
    } else {
      deferred.reject();
    }
  });
  return deferred.promise;
}

function getGameDetail(game, date) {
  var deferred = Q.defer();
  var gameId = game.id;
  gameId = gameId.split('/').join('_');
  gameId = gameId.split('-').join('_');
  var url = getDateApiUrl(date) + 'gid_' + gameId + '/linescore.json';
  request(url, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var json = JSON.parse(body);
      deferred.resolve(json.data.game);
    } else {
      deferred.reject();
    }
  });
  return deferred.promise;
}

function generatePitcherSpeech(gameDetail, date) {
  var homeTeam = gameDetail.home_team_name;
  var awayTeam = gameDetail.away_team_name;
  var homePitcher = gameDetail.home_probable_pitcher;
  var awayPitcher = gameDetail.away_probable_pitcher;
  var speechResponse;
  if (homePitcher.last_name && awayPitcher.last_name) {
    speechResponse = [
      generatePitcherText(awayPitcher),
      'is pitching for the',
      awayTeam,
      'against',
      generatePitcherText(homePitcher),
      'for the',
      homeTeam,
      getDateSpeech(date)
    ].join(' ');
  } else {
    speechResponse = [
      'Starting pitcher information isn\'t available for the',
      awayTeam,
      'against the',
      homeTeam,
      getDateSpeech(date)
    ].join(' ');
  }
  return speechResponse;
}

function generatePitcherText(pitcher) {
  var speechResponse = '';
  if (pitcher.throwinghand === 'RHP') {
    speechResponse = 'Right handed pitcher';
  } else if (pitcher.throwinghand === 'LHP') {
    speechResponse = 'Left handed pitcher';
  }
  speechResponse = [
    speechResponse,
    pitcher.first_name,
    pitcher.last_name
  ].join(' ');
  return speechResponse;
}

// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
  return {
    outputSpeech: {
      type: "PlainText",
      text: output
    },
    card: {
      type: "Simple",
      title: title,
      content: output
    },
    reprompt: {
      outputSpeech: {
        type: "PlainText",
        text: repromptText
      }
    },
    shouldEndSession: shouldEndSession
  };
}

function buildResponse(sessionAttributes, speechletResponse) {
  return {
    version: "1.0",
    sessionAttributes: sessionAttributes,
    response: speechletResponse
  };
}