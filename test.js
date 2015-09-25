var request = require('request');
var _ = require('lodash');
var Q = require('q');

var mlbApi = 'http://gd2.mlb.com/components/game/mlb/';

function getDateApiUrl() {
  var today = new Date();
  var url = mlbApi +
    'year_' + today.getFullYear() +
    '/month_' + ('0' + (today.getMonth()+1)).slice(-2) +
    '/day_' + today.getDate() +
    '/';
  return url;
}

function getGames(team) {
  var deferred = Q.defer();
  var url = getDateApiUrl() + 'grid.json';
  request(url, function(error, response, body) {
    var json = JSON.parse(body);
    var game = _.find(json.data.games.game, function(game) {
      return team === game.home_team_name || team === game.away_team_name;
    });
    if (game) {
      deferred.resolve(game);
    } else {
      deferred.reject();
    }
  });
  return deferred.promise;
}

function getGameDetail(gameId) {
  var deferred = Q.defer();
  gameId = gameId.split('/').join('_');
  gameId = gameId.split('-').join('_');
  var url = getDateApiUrl() + 'gid_' + gameId + '/linescore.json';
  request(url, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var json = JSON.parse(body);
      var homeTeam = json.data.game.home_team_name;
      var awayTeam = json.data.game.away_team_name;
      var homePitcher = json.data.game.home_probable_pitcher;
      var awayPitcher = json.data.game.away_probable_pitcher;
      deferred.resolve(json);
    }
  });
  return deferred.promise;
}

getGames('Dodgers').then(function (game) {
  return getGameDetail(game.id);
}).then(function (json) {
  console.log(json);
});