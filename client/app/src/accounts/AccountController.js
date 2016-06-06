(function(){

  angular
       .module('liskclient')
       .controller('AccountController', [
          'accountService', 'networkService', '$mdToast', '$mdSidenav', '$mdBottomSheet', '$timeout', '$log', '$mdDialog', '$scope', '$mdMedia',
          AccountController
       ]).filter('accountlabel', ['accountService', function(accountService) {
           return function(address) {
             return accountService.getUsername(address);
           };
         }
       ]);

  const {app} = require('electron').remote;
  /**
   * Main Controller for the Angular Material Starter App
   * @param $scope
   * @param $mdSidenav
   * @param avatarsService
   * @constructor
   */
  function AccountController( accountService, networkService, $mdToast, $mdSidenav, $mdBottomSheet, $timeout, $log, $mdDialog, $scope,$mdMedia) {
    var self = this;

    self.selected     = null;
    self.accounts        = [ ];
    self.selectAccount   = selectAccount;
    self.selectedVotes = [];
    self.addAccount   = addAccount;
    self.toggleList   = toggleAccountsList;
    self.sendLisk  = sendLisk;
    self.currency = JSON.parse(window.localStorage.getItem("currency")) || {name:"btc",symbol:"Ƀ"};

    self.connectedPeer={isConnected:false};
    self.connection = networkService.getConnection();
    self.connection.then(
      function(){

      },
      function(){

      },
      function(connectedPeer){
        self.connectedPeer=connectedPeer;
        if(!self.connectedPeer.isConnected){
          $mdToast.show(
            $mdToast.simple()
              .textContent('Network disconected!')
              .hideDelay(10000)
          );
        }
      }
    );

    // Load all registered accounts
    self.accounts = accountService.loadAllAccounts();
    if(self.accounts.length>0) selectAccount(self.accounts[0]);

    // *********************************
    // Internal methods
    // *********************************

    /**
     * Hide or Show the 'left' sideNav area
     */
    function toggleAccountsList() {
      if($mdMedia('sm')) $mdSidenav('left').toggle();
    }

    self.myAccounts = function(){
      return self.accounts.filter(function(account){
        return !!account.virtual;
      });
    }

    self.otherAccounts = function(){
      return self.accounts.filter(function(account){
        return !account.virtual;
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
        app.quit();
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
    }

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
            .title('Enable Virtual Folders')
            .textContent('Please enter your passphrase to enable virtual folders.')
            .placeholder('passphrase')
            .ariaLabel('Passphrase')
            .ok('Enable')
            .cancel('Cancel');
        $mdDialog.show(confirm).then(function(passphrase) {
          accountService.createVirtual(passphrase).then(function(virtual){
            account.virtual=virtual;
            $mdToast.show(
              $mdToast.simple()
                .textContent('Virtual folders enabled!')
                .hideDelay(3000)
            );
            self.createFolder(account);
          });
        });
      }
    };

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

    /**
     * Show the Contact view in the bottom sheet
     */
    function sendLisk(selectedAccount) {

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
              toAddress: $scope.send.data.toAccount.address,
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

  }

})();
