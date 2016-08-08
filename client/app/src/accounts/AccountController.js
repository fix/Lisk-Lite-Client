(function(){

  angular
       .module('liskclient')
       .controller('AccountController', [
          'accountService', 'networkService', 'changerService', '$mdToast', '$mdSidenav', '$mdBottomSheet', '$timeout', '$interval', '$log', '$mdDialog', '$scope', '$mdMedia',
          AccountController
       ]).filter('accountlabel', ['accountService', function(accountService) {
           return function(address) {
             return accountService.getUsername(address);
           };
         }
       ]).filter('exchangedate', [function() {
           return function(exchangetime) {
             return new Date(exchangetime*1000);
           };
         }
       ]);
  /**
   * Main Controller for the Angular Material Starter App
   * @param $scope
   * @param $mdSidenav
   * @param avatarsService
   * @constructor
   */
  function AccountController( accountService, networkService, changerService, $mdToast, $mdSidenav, $mdBottomSheet, $timeout, $interval, $log, $mdDialog, $scope,$mdMedia) {
    var self = this;

    self.isNetworkConnected=false;
    self.selected     = null;
    self.accounts        = [ ];
    self.selectAccount   = selectAccount;
    self.gotoAddress = gotoAddress;
    self.selectedVotes = [];
    self.addAccount   = addAccount;
    self.toggleList   = toggleAccountsList;
    self.sendLisk  = sendLisk;
    self.showAccountMenu  = showAccountMenu;
    self.currency = JSON.parse(window.localStorage.getItem("currency")) || {name:"btc",symbol:"Ƀ"};
    self.marketinfo= {};
    self.exchangeHistory=changerService.getHistory();
    console.log(self.exchangeHistory);
    self.selectedCoin=window.localStorage.getItem("selectedCoin") || "bitcoin_BTC";
    self.exchangeEmail=window.localStorage.getItem("email") || "";

    self.connectedPeer={isConnected:false};
    self.connection = networkService.getConnection();
    self.connection.then(
      function(){

      },
      function(){

      },
      function(connectedPeer){
        self.connectedPeer=connectedPeer;
        if(!self.connectedPeer.isConnected && self.isNetworkConnected){
          self.isNetworkConnected=false;
          $mdToast.show(
            $mdToast.simple()
              .textContent('Network disconected!')
              .hideDelay(10000)
          );
        }
        else if(self.connectedPeer.isConnected && !self.isNetworkConnected){
          self.isNetworkConnected=true;
          // trick to make it appear last.
          $timeout(function(){
            $mdToast.show(
              $mdToast.simple()
                .textContent('Network connected and healthy!')
                .hideDelay(10000)
            );
          },1000);

        }
      }
    );

    self.getMarketInfo=function(symbol){
      changerService.getMarketInfo(symbol,"lisk_LSK").then(function(answer){
        self.buycoin=answer;
      });

      changerService.getMarketInfo("lisk_LSK",symbol).then(function(answer){
        self.sellcoin=answer;
      });
    };

    self.getMarketInfo(self.selectedCoin);

    self.buy=function(){
      if(self.exchangeEmail) window.localStorage.setItem("email",self.exchangeEmail);
      if(self.selectedCoin) window.localStorage.setItem("selectedCoin",self.selectedCoin);
      changerService.getMarketInfo(self.selectedCoin,"lisk_LSK",self.buyAmount/self.buycoin.rate).then(function(rate){
        var amount = self.buyAmount/rate.rate;
        if(self.selectedCoin.split("_")[1]=="USD"){
          amount=parseFloat(amount.toFixed(2));
        }
        changerService.makeExchange(self.exchangeEmail, amount, self.selectedCoin, "lisk_LSK", self.selected.address).then(function(resp){
          self.exchangeBuy=resp;
          self.exchangeBuy.expirationPeriod=self.exchangeBuy.expiration-new Date().getTime()/1000;
          self.exchangeBuy.expirationProgress=0;
          self.exchangeBuy.expirationDate=new Date(self.exchangeBuy.expiration*1000);
          self.exchangeBuy.sendCurrency=self.selectedCoin.split("_")[1];
          self.exchangeBuy.receiveCurrency="LSK";
          var progressbar=$interval(function(){
            if(!self.exchangeBuy){
              $interval.cancel(progressbar);
            }
            else{
              self.exchangeBuy.expirationProgress=(100-100*(self.exchangeBuy.expiration-new Date().getTime()/1000)/self.exchangeBuy.expirationPeriod).toFixed(0);
            }
          },200);
          changerService.monitorExchange(resp).then(
            function(data){
              self.exchangeHistory=changerService.getHistory();
            },
            function(data){

            },
            function(data){
              if(data.payee && self.exchangeBuy.payee!=data.payee){
                self.exchangeBuy=data;
                self.exchangeHistory=changer.getHistory();
              }
              else{
                self.exchangeBuy.monitor=data;
              }
            }
          );

        },function(error){
          console.log(error);
          $mdToast.show(
            $mdToast.simple()
              .textContent(error.data)
              .hideDelay(10000)
          );
          self.exchangeBuy=null;
        });
      });

    };

    self.sendBatch=function(){
      changerService.sendBatch(self.exchangeBuy,self.exchangeTransactionId).then(function(data){
        self.exchangeBuy.batch_required=false;
        self.exchangeTransactionId=null;
      },
      function(error){
        console.log(error);
        $mdToast.show(
          $mdToast.simple()
            .textContent(error)
            .hideDelay(10000)
        );
      });
    }

    self.sell=function(){
      if(self.exchangeEmail) window.localStorage.setItem("email",self.exchangeEmail);
      changerService.makeExchange(self.exchangeEmail, self.sellAmount, "lisk_LSK", self.selectedCoin, self.recipientAddress).then(function(resp){
        accountService.createTransaction(0,
          {
            fromAddress: self.selected.address,
            toAddress: resp.payee,
            amount: parseInt(resp.send_amount*100000000),
            masterpassphrase: self.passphrase,
            secondpassphrase: self.secondpassphrase
          }
        ).then(function(transaction){
          console.log(transaction);
          self.exchangeTransaction=transaction
          self.exchangeSell=resp;
          self.exchangeSell.expirationPeriod=self.exchangeSell.expiration-new Date().getTime()/1000;
          self.exchangeSell.expirationProgress=0;
          self.exchangeSell.expirationDate=new Date(self.exchangeSell.expiration*1000);
          self.exchangeSell.receiveCurrency=self.selectedCoin.split("_")[1];
          self.exchangeSell.sendCurrency="LSK";
          var progressbar=$interval(function(){
            if(!self.exchangeSell){
              $interval.cancel(progressbar);
            }
            else{
              self.exchangeSell.expirationProgress=(100-100*(self.exchangeSell.expiration-new Date().getTime()/1000)/self.exchangeSell.expirationPeriod).toFixed(0);
            }
          },200);

          self.exchangeSellTransaction=transaction;
          changerService.monitorExchange(resp).then(
            function(data){
              self.exchangeHistory=changerService.getHistory();
            },
            function(data){

            },
            function(data){
              if(data.payee && self.exchangeSell.payee!=data.payee){
                self.exchangeSell=data;
                self.exchangeHistory=changer.getHistory();
              }
              else{
                self.exchangeSell.monitor=data;
              }
            }
          );
        },
        function(error){
          console.log(error);
          $mdToast.show(
            $mdToast.simple()
              .textContent(error)
              .hideDelay(10000)
          );
        });
        self.passphrase=null;
        self.secondpassphrase=null;

      },function(error){
        console.log(error);
        $mdToast.show(
          $mdToast.simple()
            .textContent(error.data)
            .hideDelay(10000)
        );
        self.exchangeSell=null;
      });
    }

    self.refreshExchange=function(exchange){
      changerService.refreshExchange(exchange).then(function(exchange){
        self.exchangeHistory=changerService.getHistory();
      });

    }

    self.exchangeLiskNow=function(transaction){
      networkService.postTransaction(transaction).then(
        function(transaction){
          self.exchangeSell.sentTransaction=transaction;
          $mdToast.show(
            $mdToast.simple()
              .textContent('Transaction '+ transaction.id +' sent with success!')
              .hideDelay(5000)
          );
        },
        function(error){
          $mdToast.show(
            $mdToast.simple()
              .textContent('Error: '+ error)
              .hideDelay(5000)
          );
        }
      );
    }

    self.cancelExchange=function(){
      if(self.exchangeBuy){
        changerService.cancelExchange(self.exchangeBuy);
        self.exchangeBuy=null;
        self.exchangeTransactionId=null;
      }
      if(self.exchangeSell){
        changerService.cancelExchange(self.exchangeSell);
        self.exchangeTransaction=null;
        self.exchangeSell=null;
      }
    }

    self.getCoins=function(){
      console.log();
      return changerService.getCoins();
    }

    // Load all registered accounts
    self.accounts = accountService.loadAllAccounts();

    // *********************************
    // Internal methods
    // *********************************

    /**
     * Hide or Show the 'left' sideNav area
     */
    function toggleAccountsList() {
      if($mdMedia('md')||$mdMedia('sm')) $mdSidenav('left').toggle();
    };

    self.myAccounts = function(){
      return self.accounts.filter(function(account){
        return !!account.virtual;
      }).sort(function(a,b){
        return b.balance-a.balance;
      });
    };

    self.myAccountsBalance = function(){
      return (self.myAccounts().reduce(function(memo,acc){
        return memo+parseInt(acc.balance);
      },0)/100000000).toFixed(2);
    }

    self.otherAccounts = function(){
      return self.accounts.filter(function(account){
        return !account.virtual;
      }).sort(function(a,b){
        return b.balance-a.balance;
      });
    }

    self.openMenu = function($mdOpenMenu, ev) {
      originatorEv = ev;
      $mdOpenMenu(ev);
    };

    self.closeApp = function() {
      var confirm = $mdDialog.confirm()
          .title('Quit Lisk Client?')
          .ok('Quit')
          .cancel('Cancel');
      $mdDialog.show(confirm).then(function() {
        require('electron').remote.app.quit();
      });
    };

    self.changeCurrency=function(){
      var currencies=[
        {name:"btc",symbol:"Ƀ"},
        {name:"usd",symbol:"$"},
        {name:"eur",symbol:"€"},
        {name:"cny",symbol:"CN¥"},
        {name:"cad",symbol:"Can$"},
        {name:"gbp",symbol:"£"},
        {name:"hkd",symbol:"HK$"},
        {name:"jpy",symbol:"JP¥"},
        {name:"rub",symbol:'\u20BD'},
        {name:"aud",symbol:"A$"}
      ];
      self.currency=currencies[currencies.map(function(x) {return x.name; }).indexOf(self.currency.name)+1];
      if(self.currency==undefined) self.currency=currencies[0];
      window.localStorage.setItem("currency",JSON.stringify(self.currency));
    };

    self.pickRandomPeer=function(){
      console.log("fire");
      networkService.pickRandomPeer();
    };

    self.getDefaultValue=function(account){
      var amount=account.balance;
      if(account.virtual){
        for (var folder in account.virtual) {
          if (account.virtual[folder].amount) {
            amount=amount-account.virtual[folder].amount;
          }
        }
      }
      return amount;
    };

    self.saveFolder=function(account,folder){
      accountService.setToFolder(account.address,folder,account.virtual.uservalue(folder)()*100000000);
    }

    self.createFolder=function(account){
      if(account.virtual){
        var confirm = $mdDialog.prompt()
            .title('Create Virtual Folder')
            .textContent('Please enter a folder name.')
            .placeholder('folder name')
            .ariaLabel('Folder Name')
            .ok('Add')
            .cancel('Cancel');
        $mdDialog.show(confirm).then(function(foldername) {
          account.virtual=accountService.setToFolder(account.address,foldername,0);
          $mdToast.show(
            $mdToast.simple()
              .textContent('Virtual folder added!')
              .hideDelay(3000)
          );
        });
      }
      else{
        var confirm = $mdDialog.prompt()
            .title('Login')
            .textContent('Please enter this account passphrase to login.')
            .placeholder('passphrase')
            .ariaLabel('Passphrase')
            .ok('Login')
            .cancel('Cancel');
        $mdDialog.show(confirm).then(function(passphrase) {
          accountService.createVirtual(passphrase).then(function(virtual){
            account.virtual=virtual;
            $mdToast.show(
              $mdToast.simple()
                .textContent('Succesfully Logged In!')
                .hideDelay(3000)
            );
            self.createFolder(account);
          }, function(err) {
            $mdToast.show(
              $mdToast.simple()
                .textContent('Error when trying to login: '+err)
                .hideDelay(3000)
            );
          });
        });
      }
    };

    function gotoAddress(address){
      var currentaddress=address;
      accountService.fetchAccountAndForget(currentaddress).then(function(a){
        self.selected=a;
        if(self.selected.delegates){
          self.selectedVotes = self.selected.delegates.slice(0);
        }
        else self.selectedVotes=[];
        accountService
          .refreshAccount(self.selected)
          .then(function(account){
            if(self.selected.address==currentaddress){
              self.selected.balance = account.balance;

              if(!self.selected.virtual) self.selected.virtual = account.virtual;
            }
          });
        accountService
          .getTransactions(currentaddress)
          .then(function(transactions){
            if(self.selected.address==currentaddress){
              if(!self.selected.transactions){
                self.selected.transactions = transactions;
              }
              else{
                transactions=transactions.sort(function(a,b){
                  return b.timestamp-a.timestamp;
                });
                var temp=self.selected.transactions.sort(function(a,b){
                  return b.timestamp-a.timestamp;
                });
                if(temp.length==0 || temp[0].id!=transactions[0].id){
                  self.selected.transactions = transactions;
                }
              }
            }
          });
        accountService
          .getVotedDelegates(self.selected.address)
          .then(function(delegates){
            if(self.selected.address==currentaddress){
              self.selected.delegates=delegates;
              self.selectedVotes = delegates.slice(0);
            }
          });
        accountService
          .getDelegate(self.selected.publicKey)
          .then(function(delegate){
            if(self.selected.address==currentaddress){
              self.selected.delegate = delegate;
            }
          });
      });

    }

    /**
     * Select the current avatars
     * @param menuId
     */
    function selectAccount (account) {
      var currentaddress=account.address;
      self.selected = accountService.getAccount(currentaddress);
      if(self.selected.delegates){
        self.selectedVotes = self.selected.delegates.slice(0);
      }
      else self.selectedVotes=[];
      accountService
        .refreshAccount(self.selected)
        .then(function(account){
          if(self.selected.address==currentaddress){
            self.selected.balance = account.balance;

            if(!self.selected.virtual) self.selected.virtual = account.virtual;
          }
        });
      accountService
        .getTransactions(currentaddress)
        .then(function(transactions){
          if(self.selected.address==currentaddress){
            if(!self.selected.transactions){
              self.selected.transactions = transactions;
            }
            else{
              transactions=transactions.sort(function(a,b){
                return b.timestamp-a.timestamp;
              });
              var temp=self.selected.transactions.sort(function(a,b){
                return b.timestamp-a.timestamp;
              });
              if(temp.length==0 || temp[0].id!=transactions[0].id){
                self.selected.transactions = transactions;
              }
            }
          }
        });
      accountService
        .getVotedDelegates(self.selected.address)
        .then(function(delegates){
          if(self.selected.address==currentaddress){
            self.selected.delegates=delegates;
            self.selectedVotes = delegates.slice(0);
          }
        });
      accountService
        .getDelegate(self.selected.publicKey)
        .then(function(delegate){
          if(self.selected.address==currentaddress){
            self.selected.delegate = delegate;
          }
        });

    }

    /**
     * Add an account
     * @param menuId
     */
    function addAccount() {
      var confirm = $mdDialog.prompt()
          .title('New Account')
          .textContent('Please enter a new address.')
          .placeholder('address')
          .ariaLabel('Address')
          .ok('Add')
          .cancel('Cancel');
      $mdDialog.show(confirm).then(function(address) {
        var isAddress = /^[0-9]+[L|l]$/g;
        if(isAddress.test(address)){
          accountService.fetchAccount(address).then(function(account){
            self.accounts.push(account);
            selectAccount(account);
            $mdToast.show(
              $mdToast.simple()
                .textContent('Account added!')
                .hideDelay(3000)
            );
          });
        }
        else{
          $mdToast.show(
            $mdToast.simple()
              .textContent('Address '+address+' is not recognised')
              .hideDelay(3000)
          );
        }

      });

    }

    function sendLisk(selectAccount){
      var data={fromAddress: selectAccount.address, secondSignature:selectAccount.secondSignature};

      function next() {
        $mdDialog.hide();
        accountService.createTransaction(0,
          {
            fromAddress: $scope.send.data.fromAddress,
            toAddress: $scope.send.data.toAddress,
            amount: parseInt($scope.send.data.amount*100000000),
            masterpassphrase: $scope.send.data.passphrase,
            secondpassphrase: $scope.send.data.secondpassphrase
          }
        ).then(
          function(transaction){
            validateTransaction(transaction);
          },
          function(error){
            $mdToast.show(
              $mdToast.simple()
                .textContent('Error: '+ error)
                .hideDelay(5000)
            );
          }
        );
      };

      function querySearch(text){
        text=text.toLowerCase();
        var filter=self.accounts.filter(function(account){
          return (account.address.toLowerCase().indexOf(text)>-1) || (account.username && (account.username.toLowerCase().indexOf(text)>-1));
        });
        return filter;
      }

      function cancel() {
        $mdDialog.hide();
      };

      $scope.send = {
        data: data,
        cancel: cancel,
        next: next,
        querySearch: querySearch
      };

      $mdDialog.show({
        parent             : angular.element(document.getElementById('app')),
        templateUrl        : './src/accounts/view/sendLisk.html',
        clickOutsideToClose: true,
        preserveScope: true,
        scope: $scope
      });
    };

    /**
     * Show the Contact view in the bottom sheet
     */
    function showAccountMenu(selectedAccount) {

      var account = selectedAccount;

      var items = [
        { name: 'Send Lisk', icon: 'send'},
        { name: 'Delete', icon: 'delete'}
      ];

      if(!selectedAccount.delegate){
        items.push({ name: 'Label', icon: 'local_offer'});
      }

      function answer(action){
        $mdBottomSheet.hide();
        if(action=="Delete"){
          var confirm = $mdDialog.confirm()
              .title('Delete Account '+ account.address)
              .textContent('Are you sure? There is no way back.')
              .ok('Delete permanently this account')
              .cancel('Cancel');
          $mdDialog.show(confirm).then(function() {
            accountService.deleteAccount(account).then(function(){
              self.accounts = accountService.loadAllAccounts();
              if(self.accounts.length>0) selectAccount(self.accounts[0]);
              $mdToast.show(
                $mdToast.simple()
                  .textContent('Account deleted!')
                  .hideDelay(3000)
              );
            });
          });
        }

        else if(action=="Send Lisk"){
          createLiskTransaction();
        }

        else if (action=="Label") {
          var prompt = $mdDialog.prompt()
              .title('Label')
              .textContent('Please enter a short label.')
              .placeholder('label')
              .ariaLabel('Label')
              .ok('Set')
              .cancel('Cancel');
          $mdDialog.show(prompt).then(function(label) {
            accountService.setUsername(selectedAccount.address,label);
            self.accounts = accountService.loadAllAccounts();
            $mdToast.show(
              $mdToast.simple()
                .textContent('Label set')
                .hideDelay(3000)
            );
          });
        }
      };

      $scope.bs={
        address: account.address,
        answer: answer,
        items: items
      };

      $mdBottomSheet.show({
        parent             : angular.element(document.getElementById('app')),
        templateUrl        : './src/accounts/view/contactSheet.html',
        clickOutsideToClose: true,
        preserveScope: true,
        scope: $scope
      });

      function createLiskTransaction() {

        var data={fromAddress: selectedAccount.address, secondSignature:selectedAccount.secondSignature};

        function next() {
          $mdDialog.hide();
          accountService.createTransaction(0,
            {
              fromAddress: $scope.send.data.fromAddress,
              toAddress: $scope.send.data.toAddress,
              amount: parseInt($scope.send.data.amount*100000000),
              masterpassphrase: $scope.send.data.passphrase,
              secondpassphrase: $scope.send.data.secondpassphrase
            }
          ).then(
            function(transaction){
              validateTransaction(transaction);
            },
            function(error){
              $mdToast.show(
                $mdToast.simple()
                  .textContent('Error: '+ error)
                  .hideDelay(5000)
              );
            }
          );
        };

        function querySearch(text){
          text=text.toLowerCase();
          var filter=self.accounts.filter(function(account){
            return (account.address.toLowerCase().indexOf(text)>-1) || (account.username && (account.username.toLowerCase().indexOf(text)>-1));
          });
          return filter;
        }

        function cancel() {
          $mdDialog.hide();
        };

        $scope.send = {
          data: data,
          cancel: cancel,
          next: next,
          querySearch: querySearch
        };

        $mdDialog.show({
          parent             : angular.element(document.getElementById('app')),
          templateUrl        : './src/accounts/view/sendLisk.html',
          clickOutsideToClose: true,
          preserveScope: true,
          scope: $scope
        });
      };


    }
    function validateTransaction(transaction){

      function send() {
        $mdDialog.hide();
        networkService.postTransaction(transaction).then(
          function(transaction){
            $mdToast.show(
              $mdToast.simple()
                .textContent('Transaction '+ transaction.id +' sent with success!')
                .hideDelay(5000)
            );
          },
          function(error){
            $mdToast.show(
              $mdToast.simple()
                .textContent('Error: '+ error)
                .hideDelay(5000)
            );
          }
        );
      };

      function cancel() {
        $mdDialog.hide();
      };

      $scope.validate={
        send:send,
        cancel:cancel,
        transaction:transaction
      };

      $mdDialog.show({
        scope              : $scope,
        preserveScope      : true,
        parent             : angular.element(document.getElementById('app')),
        templateUrl        : './src/accounts/view/showTransaction.html',
        clickOutsideToClose: true
      });
    };

  }

})();
