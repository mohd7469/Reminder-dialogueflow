(function() {

  'use strict';

  const admin = require('firebase-admin');
  const functions = require('firebase-functions');
  const moment = require('moment');

  admin.initializeApp(functions.config().firebase);

  var db = admin.firestore();

  exports.webhook = functions.https.onRequest((request, response) => {

    var requestBody = request.body;
    var params = requestBody['queryResult'];

    // for dates
    var displayFormat = 'dddd, MMMM Do YYYY, hh:mm a';
    var originalFormat = 'YYYY-MM-DDTHH:mm:ss+05:00';

    console.info('request => ', requestBody);

    switch (params.action) {
      case 'reminders.add': {
        addReminder();
        break;
      }
      case 'reminders.snooze': {
        snooze();
        break;
      }
      case 'reminders.get': {
        getReminders('get');
        break;
      }
      case 'reminders.show': {
        getReminders('show');
        break;
      }
      case 'reminders.get.past': {
        getReminders('past');
        break;
      }
      case 'reminders.get.future': {
        getReminders('future');
        break;
      }
      case 'reminders.remove.confirmation': {
        removeReminders('confirmation');
        break;
      }
      case 'reminders.remove': {
        removeReminders('remove');
        break;
      }
      default: {
        sendResponse(params.action + ', hmmm umm!');
      }
    }

    function sendResponse(value) {
      response.send({
        fulfillmentText: value
      });
    }
    function saveToDatabase(obj) {
      db.collection('reminders')
        .add(obj)
        .then((docRef) => {
          console.log('reminders added with ID: ', docRef.id);
          if(obj.name !== null) {
            sendResponse('your reminder for "' + obj.name + '" has been scheduled!');
          } else {
            sendResponse('alright! will let you know ' + calculateEstimateTime(obj.date));
          }
          return null;
        })
        .catch((error) => {
          console.error('error adding reminder: ', error);
          sendResponse('problem occur while saving!');
        });
    }
    function calculateEstimateTime(date) {
      // first convert date in original format then get the estimated time by now
      var est = moment(date, displayFormat).format(originalFormat);
      return moment(est).fromNow();
    }
    function parseDate(date) {
      // convert date to readable format
      return moment(date, originalFormat).format(displayFormat);
    }
    function snooze() {
      var reminder = {
        name: null,
        date: parseDate(params.parameters['date-time']),
        repeat: params.parameters['recurrence'] ? true : false
      };
      saveToDatabase(reminder);
    }
    function addReminder() {
      if(typeof params.parameters['date-time'] === Object) {
        console.info('date is now ', params.parameters['date-time'])
      }
      var reminder = {
        name: params.parameters.name,
        date: parseDate(params.parameters['date-time']),
        repeat: params.parameters['recurrence'] ? true : false
      };
      saveToDatabase(reminder);
    }
    function getReminders(type) {
      var today = moment();
      var reminders = [];
      function sortBy(arr, type) {
        arr.sort((a, b) => {
          if(type === 'ascending') return moment(a.date, displayFormat) - moment(b.date, displayFormat);
          else return moment(b.date, displayFormat) - moment(a.date, displayFormat);
        });
      }
      db.collection('reminders').get()
        .then((querySnapshot) => {
          querySnapshot.forEach((doc) => {
            reminders.push(doc.data());
          });
          // sort array w.r.t ascending order assuming that its up coming
          sortBy(reminders, 'ascending');

          if(reminders.length) {
            switch (type) {
              case 'get': {
                if(reminders.length && reminders.length > 1) {
                  sendResponse('you have ' + reminders.length + ' reminders, would you like to see them ?');
                }
                else {
                  sendResponse('alright, there we go. \n' + generateList(reminders));
                }
                break;
              }
              case 'show': {
                sendResponse('alright, here are your reminders. \n' + generateList(reminders));
                break;
              }
              case 'past': {
                var pastDate;
                var pastReminders = reminders.filter((reminder) => {
                  pastDate = moment(moment(reminder.date, displayFormat).format(originalFormat));
                  return pastDate.isBefore(today);
                });
                // sort array w.r.t descending order because its past
                sortBy(pastReminders, 'descending');
                console.info('pastReminders ', pastReminders);
                if(pastReminders.length) {
                  sendResponse('alright, showing previous reminders. \n' + generateList(pastReminders));
                } else {
                  sendResponse('You don\'t have any previous reminders.');
                }
                break;
              }
              case 'future': {
                var futureDate;
                var futureReminders = reminders.filter((reminder) => {
                  futureDate = moment(moment(reminder.date, displayFormat).format(originalFormat));
                  return futureDate.isAfter(today);
                });
                console.info('futureReminders ', futureReminders);
                if(futureReminders.length) {
                  // sort array w.r.t ascending order because its future
                  sortBy(futureReminders, 'ascending');
                  var msg;
                  if(futureReminders.length < 2) {
                    msg = 'alright, looks like you have something to do. \n';
                  } else {
                    msg = 'alright, it seems you have many things to do. \n';
                  }
                  sendResponse(msg + generateList(futureReminders));
                } else {
                  sendResponse('all done, you have nothing special to do, have a good day ; )');
                }
                break;
              }
            }
          } else {
            sendResponse('You\'ve no reminders yet.');
          }

          return null;
        })
        .catch((error) => {
          console.error('error in getting reminders: ', error);
          sendResponse('problem while getting reminders!');
        });
    }
    function generateList(array) {
      var list = '';
      list = array.map((obj, i) => {
        return list += (i + 1) + ': ' + obj.date + '\n';
      });
      return list;
    }
    function removeReminders(type) {
      switch (type) {
        case 'confirmation': {
          db.collection('reminders').get()
            .then((querySnapshot) => {
              var docsID = [];
              querySnapshot.forEach((doc) => {
                docsID.push(doc.id);
              });
              if(docsID.length) {
                sendResponse('REMOVING! are you sure ?');
              } else {
                sendResponse('you already have no reminders yet !');
              }
              return null;
            })
            .catch((error) => {
              console.error('error in removing reminder: ', error);
              sendResponse('problem while removing reminders!');
              return null;
            });
          break;
        }
        case 'remove': {
          db.collection('reminders').get()
            .then((querySnapshot) => {
              var docsID = [];
              querySnapshot.forEach((doc) => {
                docsID.push(doc.id);
              });
              return docsID;
            })
            .then((arrayIDs) => {
              console.log("arrayIDs => ", arrayIDs);
              var allPromises = arrayIDs.map((id)=> {
                return db.collection('reminders').doc(id).delete();
              });
              return Promise.all(allPromises)
            })
            .then((reminders) => {
              console.info('deleted reminders => ', reminders);
              sendResponse('reminder removed successfully!');
              return null;
            })
            .catch((error) => {
              console.error('error in removing reminder: ', error);
              sendResponse('problem while removing reminders!');
              return null;
            });
          break;
        }
      }
    }
  });
})();
