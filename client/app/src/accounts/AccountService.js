(function(){
  'use strict';

  angular.module('liskclient')
         .service('accountService', ['$q','$http','networkService', AccountService]);

  /**
   * Accounts DataService
   * Uses embedded, hard-coded data model; acts asynchronously to simulate
   * remote data service call(s).
   *
   * @returns {{loadAll: Function}}
   * @constructor
   */
  function AccountService($q,$http,networkService){

    var lisk=require('lisk-js');

    var TxTypes = {
      0:"Send Lisk",
      1:"Second Signature Creation",
      2:"Delegate Registration",
      3:"Vote",
      4:"Multisignature Creation",
      5:"Blockchain Application Registration",
      6:"Transfer Lisk to Blockchain Application",
      7:"Transfer Lisk from Blockchain Application"
    };

    var peer=networkService.getPeer().ip;

    function showTimestamp(time){
      var d = new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0));
      var t = parseInt(d.getTime() / 1000);

      time = new Date((time + t) * 1000);

      var currentTime = new Date().getTime();
      var diffTime = (currentTime - time.getTime()) / 1000;

      if (diffTime < 60) {
          return Math.floor(diffTime) + ' sec ago';
      }
      if (Math.floor(diffTime / 60) <= 1) {
          return Math.floor(diffTime / 60) + ' min ago';
      }
      if ((diffTime / 60) < 60) {
          return Math.floor(diffTime / 60) + ' mins ago';
      }
      if (Math.floor(diffTime / 60 / 60) <= 1) {
          return Math.floor(diffTime / 60 / 60) + ' hour ago';
      }
      if ((diffTime / 60 / 60) < 24) {
          return Math.floor(diffTime / 60 / 60) + ' hours ago';
      }
      if (Math.floor(diffTime / 60 / 60 / 24) <= 1) {
          return Math.floor(diffTime / 60 / 60 / 24) + ' day ago';
      }
      if ((diffTime / 60 / 60 / 24) < 30) {
          return Math.floor(diffTime / 60 / 60 / 24) + ' days ago';
      }
      if (Math.floor(diffTime / 60 / 60 / 24 / 30) <= 1) {
          return Math.floor(diffTime / 60 / 60 / 24 / 30) + ' month ago';
      }
      if ((diffTime / 60 / 60 / 24 / 30) < 12) {
          return Math.floor(diffTime / 60 / 60 / 24 / 30) + ' months ago';
      }
      if (Math.floor((diffTime / 60 / 60 / 24 / 30 / 12)) <= 1) {
          return Math.floor(diffTime / 60 / 60 / 24 / 30 / 12) + ' year ago';
      }

      return Math.floor(diffTime / 60 / 60 / 24 / 30 / 12) + ' years ago';
    };

    function fetchAccount(address){
      var deferred = $q.defer();
      networkService.getFromPeer('/api/accounts?address='+address).then(
        function (resp) {
          if(resp.success){
            var account=resp.account;
            deferred.resolve(account);
            addAccount(account);
          }
          else{
            account={
              address:address,
              balance:0,
              secondSignature:false,
              cold:true
            };
            deferred.resolve(account);
            addAccount(account);
          }
        }
      );
      return deferred.promise;
    };


    function addAccount(account){
      if(!account || !account.address){
        return;
      }
      window.localStorage.setItem(account.address,JSON.stringify(account));
      var addresses=window.localStorage.getItem("addresses");
      if(!addresses){
        addresses=[];
      }
      else{
        addresses=JSON.parse(addresses);
      }
      if(addresses.indexOf(account.address)==-1){
        addresses.push(account.address);
        window.localStorage.setItem("addresses",JSON.stringify(addresses));
      }
    };

    function deleteAccount(account){
      if(!account || !account.address){
        return $q.when(null);
      }
      //delete account data
      window.localStorage.removeItem(account.address);
      window.localStorage.removeItem("transactions-"+account.address);
      window.localStorage.removeItem("voters-"+account.address);

      //remove the address from stored addresses
      var addresses=JSON.parse(window.localStorage.getItem("addresses"));
      addresses.splice(addresses.indexOf(account.address),1);
      window.localStorage.setItem("addresses",JSON.stringify(addresses));
      return $q.when(account);
    };

    function getTransactions(address) {
      var deferred = $q.defer();
      $http.get(peer+"/api/transactions?orderBy=t_timestamp:desc&recipientId=" +address +"&senderId="+address).then(function (resp) {
        if(resp.data.success){
          for(var i=0;i<resp.data.transactions.length;i++){
            var transaction = resp.data.transactions[i];
            transaction.label=TxTypes[transaction.type];
            transaction.date=showTimestamp(transaction.timestamp);
          }
          window.localStorage.setItem("transactions-"+address,JSON.stringify(resp.data.transactions));
          deferred.resolve(resp.data.transactions);
        }
        else{
          deferred.reject("Cannot get transactions");
        }
      });
      return deferred.promise;
    };

    function getDelegate(publicKey){
      var deferred = $q.defer();
      $http.get(peer+"/api/delegates/get/?publicKey="+publicKey).then(function (resp) {
        if(resp.data && resp.data.success && resp.data.delegate){
          window.localStorage.setItem("delegate-"+resp.data.delegate.address,JSON.stringify(resp.data.delegate));
          window.localStorage.setItem("username-"+resp.data.delegate.address,resp.data.delegate.username);
          deferred.resolve(resp.data.delegate);
        }
        else{
          deferred.reject("Cannot state if account is a delegate");
        }
      });
      return deferred.promise;
    };

    function getVotedDelegates(address){
      var deferred = $q.defer();
      $http.get(peer+"/api/accounts/delegates/?address="+address).then(function(resp){
        if(resp.data && resp.data.success){
          window.localStorage.setItem("voted-"+address,JSON.stringify(resp.data.delegates));
          deferred.resolve(resp.data.delegates);
        }
        else{
          deferred.reject("Cannot get voted delegates");
        }
      });
      return deferred.promise;
    };

    function sendLisk(toAddress, amount, masterpassphrase, secondpassphrase){
      var deferred = $q.defer();
      try{
        var transaction=lisk.transaction.createTransaction(toAddress, amount, masterpassphrase, secondpassphrase);
      }
      catch(e){
        deferred.reject(e);
        return deferred.promise;
      }
      $http({
        url: peer+'/peer/transactions',
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

    return {
      loadAllAccounts : function() {
        var accounts = JSON.parse(window.localStorage.getItem("addresses"));
        if(!accounts){
          return [];
        }
        return accounts.map(function(address){
          var account=JSON.parse(window.localStorage.getItem(address));
          if(account){
            account.transactions=JSON.parse(window.localStorage.getItem("transactions-"+address));
            return account;
          }
          return {address:address}
        });
      },

      getAccount: function(address){
        var stringaccount=window.localStorage.getItem(address);
        if(stringaccount){
          var account=JSON.parse(stringaccount);
          account.transactions=JSON.parse(window.localStorage.getItem("transactions-"+address));
          return account;
        }
        else{
          return null;
        }
      },

      refreshAccount: function(account){
        return fetchAccount(account.address);
      },

      addAccount: addAccount,

      deleteAccount: deleteAccount,

      fetchAccount: fetchAccount,

      getTransactions: getTransactions,

      sendLisk: sendLisk,

      getVotedDelegates: getVotedDelegates,

      getDelegate: getDelegate
    }
  }

})();
