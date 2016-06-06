(function(){
  'use strict';

  angular.module('liskclient')
         .service('networkService', ['$q', '$http', '$timeout', NetworkService]);

  /**
   * NetworkService
   * @constructor
   */
  function NetworkService($q,$http,$timeout){

    var lisk=require('lisk-js');

    var peer={ip:'https://login.lisk.io', isConnected:false, height:0, lastConnection:null};

    var connection=$q.defer();

    connection.notify(peer);


    function getPrice(){
      $http.get("http://coinmarketcap.northpole.ro/api/v5/LSK.json",{timeout: 2000}).success(function(data){
        peer.market=data;
      });
      $timeout(function(){
        getPrice();
      },5*60000);
    };

    function getHeight(){
      $http.get(peer.ip+"/api/blocks/getheight",{timeout:2000}).then(function(resp){
        peer.lastConnection=new Date();
        if(resp.data && resp.data.success){
          if(peer.height==resp.data.height){
            peer.isConnected=false;
            peer.error="Node is experiencing sychronisation issues";
            connection.notify(peer);
            pickRandomPeer();
            return;
          }
          else{
            peer.height=resp.data.height;
            peer.isConnected=true;
            connection.notify(peer);
          }
        }
        else{
          peer.isConnected=false;
          peer.error=resp.statusText || "Peer Timeout after 2s";
          connection.notify(peer);
        }
      });
      $timeout(function(){
        getHeight();
      },60000);
    };

    function getFromPeer(api){
      var deferred = $q.defer();
      peer.lastConnection=new Date();
      $http.get(peer.ip+api,{timeout:2000}).then(
        function(resp){
          deferred.resolve(resp.data);
          peer.isConnected=true;
          peer.delay=new Date().getTime()-peer.lastConnection.getTime();
          connection.notify(peer);
        },
        function(resp){
          deferred.reject("Peer disconnected");
          peer.isConnected=false;
          peer.error=resp.statusText || "Peer Timeout after 2s";
          connection.notify(peer);
        }
      );
      return deferred.promise;
    }

    function postTransaction(transaction){
      var deferred = $q.defer();
      $http({
        url: peer.ip+'/peer/transactions',
        data: { transaction: transaction },
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'os': 'liskwalletapp',
          'version': '0.0.3',
          'port': 1,
          'nethash': 'ed14889723f24ecc54871d058d98ce91ff2f973192075c0155ba2b7b70ad2511'
        }
      }).then(function(resp){
        if(resp.data.success){
          deferred.resolve(transaction);
        }
        else{
          deferred.reject(resp.data.message);
        }
      });
      return deferred.promise;
    };

    function pickRandomPeer(){
      getFromPeer("/api/peers?state=2").then(function(response){
        if(response.success){
          findGoodPeer(response.peers,0);
        }
      })
    };

    function findGoodPeer(peers, index){
      if(index>peers.length-1){
        peer.ip="https://login.lisk.io";
        return;
      }
      peer.ip="http://"+peers[index].ip+":"+peers[index].port;
      getFromPeer("/api/blocks/getheight").then(function(response){
        if(response.success && response.height<peer.height){
          findGoodPeer(peers, index+1);
        }
        else {
          return;
        }
      },
      function(error){
        findGoodPeer(peers, index+1);
      });
    }

    function getPeer(){
      return peer;
    };

    function getConnection(){
      return connection.promise;
    }

    getHeight();
    getPrice();
    pickRandomPeer();


    return {
      getPeer: getPeer,
      getConnection: getConnection,
      getFromPeer: getFromPeer,
      postTransaction: postTransaction,
      pickRandomPeer:pickRandomPeer
    }
  }

})();
