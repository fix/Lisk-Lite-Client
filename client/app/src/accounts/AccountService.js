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
            account.cold=!account.publicKey;
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

    function fetchAccountAndForget(address){
      var deferred = $q.defer();
      networkService.getFromPeer('/api/accounts?address='+address).then(
        function (resp) {
          if(resp.success){
            var account=resp.account;
            account.cold=!account.publicKey;
            deferred.resolve(account);
          }
          else{
            account={
              address:address,
              balance:0,
              secondSignature:false,
              cold:true
            };
            deferred.resolve(account);
          }
        }
      );
      return deferred.promise;
    };

    function getAccount(address){
      var stringaccount=window.localStorage.getItem(address);
      if(stringaccount){
        var account=JSON.parse(stringaccount);
        account.transactions=JSON.parse(window.localStorage.getItem("transactions-"+address));
        account.username=window.localStorage.getItem("username-"+address);
        account.delegate=JSON.parse(window.localStorage.getItem("delegate-"+address));
        account.virtual=getVirtual(address);
        return account;
      }
      else{
        return null;
      }
    }


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
      window.localStorage.removeItem("username-"+account.address);

      //remove the address from stored addresses
      var addresses=JSON.parse(window.localStorage.getItem("addresses"));
      addresses.splice(addresses.indexOf(account.address),1);
      window.localStorage.setItem("addresses",JSON.stringify(addresses));
      return $q.when(account);
    };

    function getTransactions(address) {
      var deferred = $q.defer();
      var d = new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0));
      var t = parseInt(d.getTime() / 1000);
      $http.get(peer+"/api/transactions?orderBy=timestamp:desc&recipientId=" +address +"&senderId="+address).then(function (resp) {
        if(resp.data.success){
          for(var i=0;i<resp.data.transactions.length;i++){
            var transaction = resp.data.transactions[i];
            transaction.label=TxTypes[transaction.type];
            transaction.date=new Date((transaction.timestamp + t) * 1000);
            if(transaction.recipientId==address){
              transaction.total=transaction.amount;
              if(transaction.type==0){
                transaction.label="Receive Lisk";
              }
            }
            if(transaction.senderId==address){
              transaction.total=-transaction.amount-transaction.fee;
            }
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
      if(!publicKey){
        deferred.reject("No publicKey");
        return deferred.promise;
      }
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

    function getDelegateByUsername(username){
      var deferred = $q.defer();
      if(!username){
        deferred.reject("No Username");
        return deferred.promise;
      }
      $http.get(peer+"/api/delegates/get/?username="+username).then(function (resp) {
        if(resp.data && resp.data.success && resp.data.delegate){
          window.localStorage.setItem("delegate-"+resp.data.delegate.address,JSON.stringify(resp.data.delegate));
          window.localStorage.setItem("username-"+resp.data.delegate.address,resp.data.delegate.username);
          deferred.resolve(resp.data.delegate);
        }
        else{
          deferred.reject("Cannot find delegate: "+ username);
        }
      });
      return deferred.promise;
    };

    //TODO: NOT working yet, waiting for 0.3.2
    function searchDelegates(term){
      var deferred = $q.defer();
      if(!term){
        deferred.reject("No search term");
        return deferred.promise;
      }
      $http.get(peer+"/api/delegates/search/?term="+term).then(function (resp) {
        if(resp.data && resp.data.success && resp.data.delegates){
          deferred.resolve(resp.data.delegates);
        }
        else{
          deferred.reject("Cannot find delegates from this term: "+term);
        }
      }, function(err){
        deferred.reject("Cannot find delegates on this peer: "+err);
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

    function createTransaction(type,config){
      var deferred = $q.defer();
      if(type==0){ //send lisk
        var isAddress = /^[0-9]+[L|l]$/g;
        if(!isAddress.test(config.toAddress)){
          deferred.reject("The destination address "+config.toAddress+" is erroneous");
          return deferred.promise;
        }

        var account=getAccount(config.fromAddress);
        if(config.amount+10000000>account.balance){
          deferred.reject("Not enough LSK on your account "+config.fromAddress);
          return deferred.promise;
        }

        try{
          var transaction=lisk.transaction.createTransaction(config.toAddress, config.amount, config.masterpassphrase, config.secondpassphrase);
        }
        catch(e){
          deferred.reject(e);
          return deferred.promise;
        }

        if(lisk.crypto.getAddress(transaction.senderPublicKey)!=config.fromAddress){
          deferred.reject("Passphrase is not corresponding to account "+config.fromAddress);
          return deferred.promise;
        }

        transaction.senderId=config.fromAddress;
        deferred.resolve(transaction);
      }

      else if(type==3){ //vote
        var account=getAccount(config.fromAddress);
        if(account.balance<100000000){
          deferred.reject("Not enough LSK on your account "+config.fromAddress+", you need at least 1 LSK to vote");
          return deferred.promise;
        }
        try{
          var transaction=lisk.vote.createVote(config.masterpassphrase, config.publicKeys.split(","), config.secondpassphrase);
        }
        catch(e){
          deferred.reject(e);
          return deferred.promise;
        }
        if(lisk.crypto.getAddress(transaction.senderPublicKey)!=config.fromAddress){
          deferred.reject("Passphrase is not corresponding to account "+config.fromAddress);
          return deferred.promise;
        }
        transaction.senderId=config.fromAddress;
        deferred.resolve(transaction);
      }
      return deferred.promise;
    };

    // Given a final list of delegates, create a vote assets list to be sent
    // return null if could not make it
    function createDiffVote(address, newdelegates){

      function arrayObjectIndexOf(myArray, searchTerm, property) {
        for(var i = 0, len = myArray.length; i < len; i++) {
          if (myArray[i][property] === searchTerm) return i;
        }
        return -1;
      }

      var assets = [];
      var votedDelegates = JSON.parse(window.localStorage.getItem("voted-"+address)) || [];
      votedDelegates = votedDelegates.map(function(delegate){
        return {
          username: delegate.username,
          address: delegate.address,
          publicKey: delegate.publicKey
        };
      });

      var delegates = newdelegates.map(function(delegate){
        return {
          username: delegate.username,
          address: delegate.address,
          publicKey: delegate.publicKey
        };
      });

      if(delegates.length>101){
        return null;
      }
      var difflist=[];
      var notRemovedDelegates=[];
      for(var i in delegates){
        var delegate = delegates[i];
        if(arrayObjectIndexOf(votedDelegates,delegate.publicKey,"publicKey") == -1){
          delegate.vote="+"
          difflist.push(delegate);
        }
        else {
          notRemovedDelegates.push(delegate);
        }
        if(difflist.length == 33){
          assets.push(difflist);
          difflist = [];
        }
      }
      for(var i in votedDelegates){
        var delegate = votedDelegates[i];
        if(arrayObjectIndexOf(notRemovedDelegates,delegate.publicKey,"publicKey") == -1){
          delegate.vote="-"
          difflist.push(delegate);
        }
        if(difflist.length == 33){
          assets.push(difflist);
          difflist = [];
        }
      }
      if(difflist.length > 0){
        assets.push(difflist);
      }
      console.log(assets);
      return assets;
    };

    function getSponsors(){
      var deferred = $q.defer();
      var result=[];
      $http.get("https://gist.githubusercontent.com/fix/a7b1d797be38b0591e725a24e6735996/raw/sponsors.json").then(function (resp) {
        var count=0;
        for(var i in resp.data){
          $http.get(peer+"/api/delegates/get/?publicKey="+resp.data[i].publicKey).then(function (resp2) {
            if(resp2.data && resp2.data.success && resp2.data.delegate){
              result.push(resp2.data.delegate);
            }
            count++;
            if(count==resp.data.length-1){
              deferred.resolve(result);
            }
          },
          function(error){
            count++;
          });
        }
      },function(err){
        console.log(err);
        deferred.reject("Cannot get sponsors");
      });
      return deferred.promise;
    };

    function createVirtual(passphrase){
      var deferred = $q.defer();
      var address=lisk.crypto.getAddress(lisk.crypto.getKeys(passphrase).publicKey);
      var account=getAccount(address);
      if(account){
        account.virtual=account.virtual || {};
        window.localStorage.setItem("virtual-"+address, JSON.stringify(account.virtual));
        deferred.resolve(account.virtual);
      }
      else{
        deferred.reject("Passphrase does not match your address");
      }

      return deferred.promise;
    };

    function setToFolder(address, folder, amount){
      var virtual=getVirtual(address);
      console.log(virtual);
      var f=virtual[folder];
      if(f && amount>=0){
        f.amount=amount;
      }
      else if(!f && amount>=0){
        virtual[folder]={amount:amount};
      }
      window.localStorage.setItem("virtual-"+address, JSON.stringify(virtual));
      return getVirtual(address);
    };

    function deleteFolder(address, folder){
      var virtual=getVirtual(address);
      virtual[folder]=null;
      window.localStorage.setItem("virtual-"+address, JSON.stringify(virtual));
      return virtual;
    };

    function getVirtual(address){
      var virtual=JSON.parse(window.localStorage.getItem("virtual-"+address));
      if(virtual){
        virtual.uservalue=function(folder){
          return function(value){
            if(virtual[folder]){
              if(arguments.length==1){
                if(value===null){
                  return virtual[folder].amount=null;
                }
                else{
                  return virtual[folder].amount=value*100000000;
                }
              }
              else{
                return virtual[folder].amount===null?"":virtual[folder].amount/100000000;
              }
            }
          }
        };
        virtual.getFolders=function(){
          var folders=[];
          for (var i in virtual){
            if (virtual.hasOwnProperty(i) && typeof virtual[i] != 'function') {
              folders.push(i);
            }
          }
          return folders;
        }
      }
      return virtual;
    }


    return {
      loadAllAccounts : function() {
        var accounts = JSON.parse(window.localStorage.getItem("addresses"));
        if(!accounts){
          return [];
        }
        accounts=accounts.filter(function(address){
          return window.localStorage.getItem("username-"+address)!=null;
        });
        return accounts.map(function(address){
          var account=JSON.parse(window.localStorage.getItem(address));
          if(account){
            account.transactions=JSON.parse(window.localStorage.getItem("transactions-"+address));
            account.delegate=JSON.parse(window.localStorage.getItem("delegate-"+address));
            account.username=window.localStorage.getItem("username-"+address);
            account.virtual=getVirtual(address);
            return account;
          }
          return {address:address}
        });
      },

      getAccount: getAccount,

      refreshAccount: function(account){
        return fetchAccount(account.address);
      },

      setUsername: function(address,username){
        window.localStorage.setItem("username-"+address,username);
      },

      getUsername: function(address){
        return window.localStorage.getItem("username-"+address) || address;
      },

      addAccount: addAccount,

      deleteAccount: deleteAccount,

      fetchAccount: fetchAccount,

      fetchAccountAndForget: fetchAccountAndForget,

      getTransactions: getTransactions,

      createTransaction: createTransaction,

      createDiffVote: createDiffVote,

      getVotedDelegates: getVotedDelegates,

      getDelegate: getDelegate,

      getDelegateByUsername: getDelegateByUsername,

      getSponsors: getSponsors,

      createVirtual: createVirtual,

      setToFolder: setToFolder,

      deleteFolder: deleteFolder
    }
  }

})();
