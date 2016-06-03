(function(){

  angular
       .module('liskclient')
       .controller('AccountController', [
          'accountService', 'networkService', '$mdSidenav', '$mdBottomSheet', '$timeout', '$log', '$mdDialog', '$mdToast',
          AccountController
       ]);

  const {dialog} = require('electron').remote;
  /**
   * Main Controller for the Angular Material Starter App
   * @param $scope
   * @param $mdSidenav
   * @param avatarsService
   * @constructor
   */
  function AccountController( accountService, networkService, $mdSidenav, $mdBottomSheet, $timeout, $log, $mdDialog, $mdOpenMenu, $mdToast ) {
    var self = this;

    self.selected     = null;
    self.accounts        = [ ];
    self.selectAccount   = selectAccount;
    self.selectedVotes = [];
    self.addAccount   = addAccount;
    self.toggleList   = toggleAccountsList;
    self.makeContact  = makeContact;

    self.connectedPeer={isConnected:false};
    self.connection = networkService.getConnection();
    self.connection.then(
      function(){

      },
      function(){

      },
      function(connectedPeer){
        self.connectedPeer=connectedPeer;
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
      $mdSidenav('left').toggle();
    }

    self.openWifi = function($mdOpenMenu, ev) {
      originatorEv = ev;
      $mdOpenMenu(ev);
    };

    /**
     * Select the current avatars
     * @param menuId
     */
    function selectAccount ( account ) {
      var currentaddress=account.address;
      self.selected = angular.isNumber(account) ? $scope.accounts[account] : account;
      accountService
        .refreshAccount(self.selected)
        .then(function(account){
          if(self.selected.address==currentaddress){
            self.selected = account;
          }
        });
      accountService
        .getTransactions(currentaddress)
        .then(function(transactions){
          if(self.selected.address==currentaddress){
            if(!self.selected.transactions || self.selected.transactions[0].id!==transactions[0].id){
              self.selected.transactions = transactions;
            }
          }
        });
      accountService
        .getVotedDelegates(currentaddress)
        .then(function(delegates){
          if(self.selected.address==currentaddress){
            self.selected.delegates = delegates;
            self.selectedVotes = delegates.slice(0);
          }
        });
      accountService
        .getDelegate(account.publicKey)
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
        accountService.fetchAccount(address).then(function(account){
          self.accounts.push(account);
          selectAccount(account);
          $mdToast.show(
            $mdToast.simple()
              .textContent('Account added!')
              .hideDelay(3000)
          );
        });

      });

    }

    /**
     * Show the Contact view in the bottom sheet
     */
    function makeContact(selectedAccount) {

        $mdBottomSheet.show({
          controllerAs  : "vm",
          templateUrl   : './src/accounts/view/contactSheet.html',
          controller    : [ '$mdBottomSheet', ContactSheetController],
          parent        : angular.element(document.getElementById('content'))
        }).then(function(clickedItem) {
          $log.debug( clickedItem.address + ' clicked!');
        });

        /**
         * Account ContactSheet controller
         */
        function ContactSheetController( $mdBottomSheet ) {
          this.account = selectedAccount;
          this.send={fromAddress: selectedAccount.address, secondSignature:selectedAccount.secondSignature}
          this.items = [
            { name: 'Send Lisk', icon: 'send'},
            { name: 'Delete', icon: 'delete'}
          ];
          this.answer=function(answer){
            $mdDialog.hide(answer);
          }
          this.contactAccount = function(action) {

            $mdBottomSheet.hide(action);
            if(action.name=="Delete"){
              var confirm = $mdDialog.confirm()
                  .title('Delete Account '+ this.account.address)
                  .textContent('Are you sure? There is no way back.')
                  .ok('Delete permanently this account')
                  .cancel('Cancel');
              $mdDialog.show(confirm).then(function() {
                accountService.deleteAccount(selectedAccount).then(function(account){
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

            if(action.name=="Send Lisk"){
                $mdDialog.show({
                  controllerAs       : "vm",
                  controller         : [ '$mdBottomSheet', ContactSheetController],
                  parent             : angular.element(document.getElementById('content')),
                  templateUrl        : './src/accounts/view/sendLisk.html',
                  clickOutsideToClose: true
                }).then(function(vm) {
                  if(vm){
                    accountService.sendLisk(vm.send.toAddress, parseInt(vm.send.amount*100000000), vm.send.passphrase, vm.send.secondpassphrase).then(
                      function(transaction){
                        $mdToast.show(
                          $mdToast.simple()
                            .textContent('Transaction '+transaction.id+' sent!')
                            .hideDelay(5000)
                        );
                      },
                      function(reason) {
                        $mdToast.show(
                          $mdToast.simple()
                            .textContent('Error: '+reason)
                            .hideDelay(5000)
                        );
                      }
                    );
                  }
                }, function() {

                });


            }

          };
        }
    }

  }

})();
