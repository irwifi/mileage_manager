"use strict";
const express = require('express');
const async = require('async');
const request = require('supertest');
const chai = require('chai');
const expect = chai.expect;

const app = require('../../app/app');
const hdb = require('../../app/handlers/hdb_mongo');
const muser = require("../../app/models/musers");

chai.use(require('chai-string'));

// insert data into the document
const insert_data = (err, params, callback) => {
	hdb.db.collection(params.doc).insert(params.data, callback);
};

// fetch document from database
const find_doc = (err, params, callback) => {
	hdb.db.collection(params.doc).find(params.condition, params.select, callback);
};

// fetch one document from database
const find_one = (err, params, callback) => {
	hdb.db.collection(params.doc).findOne(params.condition, params.select, callback);
};

// expect object
const expect_object = (err, params) => {
	expect(params.obj).to.be.an('object');
	for(const item in params.obj_items) {
		if( Array.isArray(params.obj_items[item]) === true ) {
			expect(params.obj).to.have.property(params.obj_items[item][0], params.obj_items[item][1]);
		} else {
			expect(params.obj).to.have.property(params.obj_items[item]);
		}
	}
}

// return date with mm/dd/YYYY format
const date_from_today = (difference, date_stamp) => {
	let today;
	if(date_stamp === undefined) {
		today = new Date();
	} else {
		today = new Date(date_stamp);
	}
	const return_date =  (today.getMonth() + 1) + '/' + (today.getDate() + difference) + '/' + today.getFullYear();

	return  return_date;
};

describe('Mileage Manager Tests:', () => {
	const logged_app = request.agent(app) ;

	// this block runs only once before everything else within this test
	// log in before starting the tests
	before((done) => {
		async.series([
			(async_callback) => {
				hdb.connect(null, {}, async_callback);
			},
			(async_callback) => {
				hdb.db.createCollection('settings', 
					(err, result) => {
						async_callback(err);
					}
				);
			},			(async_callback) => {
				hdb.db.createCollection('readings', 
					(err, result) => {
						async_callback(err);
					}
				);
			},
			(async_callback) => {
				hdb.db.createCollection('users', 
					(err, result) => {
						async_callback(err);
					}
				);
			},
			(async_callback) => {
				hdb.db.collection('users').remove(
					(err, result) => {
						async_callback(err);
					}
				);
			},
			(async_callback) => {				
				muser.create_new_user(null, {doc_data: {user_email: 'abc@sample.com', password: '123456', user_role: 'admin'}}, async_callback);
			},
			(async_callback) => {
				logged_app
				.post('/authen/signin')
				.send({ signin_email: 'abc@sample.com', signin_password: '123456'})
				.end((err, res) => {
          				if (err) return done(err);
          				done();
        			});
			}
		], done);
	});

	// this will run before each describes within this test
	beforeEach((done) => {
		async.series([
			(async_callback) => {
				hdb.db.collection('readings').remove(
					(err, result) => {
						async_callback(err);
					}
				);
			},
			(async_callback) => {
				hdb.db.collection('settings').remove(
					(err, result) => {
						async_callback(err);
					}
				);
			}
		], done);
	});

	// Dashboard functionality
	describe('Dashboard functionality:', () => {
		it('Landing page after authentication', (done) => {
			logged_app
			.get('/')
			.expect(302)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.headers).to.have.property('location');
				expect(res.headers.location).to.equal('/readings');
				done();
			});
		});

		it('Dashboard response without any data', (done) => {
			logged_app
			.get('/readings')
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('navbar-nav');
				expect(res.text).to.containIgnoreSpaces('navbar-right');
				expect(res.text).to.containIgnoreSpaces('abc@sample.com');
				expect(res.text).to.containIgnoreSpaces('<a href="/authen/signout"> Sign Out </a>');
				expect(res.text).to.containIgnoreSpaces('id="form_readings"');
				expect(res.text).to.containIgnoreSpaces('Chart data not available');
				expect(res.text).to.containIgnoreSpaces('Travel data not available');
				done();
			});
		});

		it('Dashboard response with travel data', (done) => {
			async.series([
				(async_callback) => {
					// insert data for test
					insert_data(null, {doc: 'readings', data: {date: date_from_today(0), km_readings: 1, fuel_added: 5, fuel_readings: 5, destination: 'Base'}}, async_callback);
				},
				(async_callback) => {
					logged_app
					.get('/readings')
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						async.waterfall([
							(async_callback) => {async_callback(null, null, {doc: "readings", condition: {}, select: {}});},
								find_one
							], (err, readings_data) => {
								expect(res.text).to.containIgnoreSpaces('navbar-nav');
								expect(res.text).to.containIgnoreSpaces('navbar-right');
								expect(res.text).to.containIgnoreSpaces('abc@sample.com');
								expect(res.text).to.containIgnoreSpaces('<a href="/authen/signout"> Sign Out </a>');
								expect(res.text).to.containIgnoreSpaces('id="form_readings"');
								expect(res.text).to.not.containIgnoreSpaces('Chart data not available');
								expect(res.text).to.not.containIgnoreSpaces('Travel data not available');
								expect_object(null, {obj: readings_data, obj_items: [['date', date_from_today(0)], ['km_readings', 1], ['fuel_added', 5], ['fuel_readings', 5], ['destination', 'Base']]});
								done();
							}
						);
					});
				}
			], done);
		});
	});

	// Settings functionality
	describe('Settings functionality:', () => {
		it('Settings response:', (done) => {
			logged_app
			.get('/settings')
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('navbar-nav');
				expect(res.text).to.containIgnoreSpaces('navbar-right');
				expect(res.text).to.containIgnoreSpaces('id="form_settings"');
				done();
			});
		});

		it('Settings submit without any data', (done) => {
			logged_app
			.put('/settings')
			.send({ km_mile: '', max_fuel_capacity: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_settings"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger');
				expect(res.text).to.containIgnoreSpaces('Please select Kilometer or Mile');
				expect(res.text).to.containIgnoreSpaces('Please enter maximum fuelcapacity');
				done();
			});
		});

		it('Settings submit with invalid data', (done) => {
			logged_app
			.put('/settings')
			.send({ km_mile: '123', max_fuel_capacity: 'invalid' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_settings"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger');
				expect(res.text).to.containIgnoreSpaces('Please enter valid Km/Mile value');
				expect(res.text).to.containIgnoreSpaces('Please enter valid maximum fuel capacity');
				done();
			});
		});

		it('Settings submit with max_fuel_capacity less than 1', (done) => {
			logged_app
			.put('/settings')
			.send({ km_mile: 'km', max_fuel_capacity: '-1' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_settings"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger');
				expect(res.text).to.containIgnoreSpaces('Please enter valid maximum fuel capacity');
				done();
			});
		});

		it('Settings submit with exceeding values (km_mile exceeding 4 digits and max_fuel_capacity exceeding 2 digits)', (done) => {
			logged_app
			.put('/settings')
			.send({ km_mile: 'invalid', max_fuel_capacity: '100' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_settings"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger');
				expect(res.text).to.containIgnoreSpaces('Please enter valid Km/Mile value');
				expect(res.text).to.containIgnoreSpaces('Please enter valid maximum fuel capacity');
				done();
			});
		});

		it('Settings submit with valid data', (done) => {
			async.series([
				(async_callback) => {
					// insert settings for test
					insert_data(null, {doc: 'settings', data: {km_mile: 'mile', max_fuel_capacity: 15}}, async_callback);
				},
				(async_callback) => {
					logged_app
					.put('/settings')
					.send({ km_mile: 'km', max_fuel_capacity: '18' })
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						async.waterfall([
							(async_callback) => {async_callback(null, null, {doc: "settings", condition: {}, select: {}});},
								find_one
							], (err, settings_info) => {
								expect(res.text).to.containIgnoreSpaces('id="form_settings"');
								expect(res.text).to.not.containIgnoreSpaces('<div class="alert alert-danger');
								expect(res.text).to.containIgnoreSpaces('<div class="alert alert-success');
								expect(res.text).to.containIgnoreSpaces('Settings have been updated');
								expect_object(null, {obj: settings_info, obj_items: [['km_mile', 'km'], ['max_fuel_capacity', 18]]});
								done();
							}
						);
					});
				}
			], done);
		});
	});

	// Travel Info entry functionality
	describe('Travel Info entry functionality:', () => {
		it('Travel Info submit without any data', (done) => {
			logged_app
			.post('/readings')
			.send({ travel_date: '', odo_readings: '', fuel_added: '', fuel_readings: '', destination: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_readings"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger');
				expect(res.text).to.containIgnoreSpaces('Please enter the date');
				expect(res.text).to.containIgnoreSpaces('Please enter the odometer readings');
				expect(res.text).to.containIgnoreSpaces('Please enter the fuel readings');
				expect(res.text).to.containIgnoreSpaces('Please enter the destination');
				done();
			});
		});

		it('Travel Info submit with invalid data (date, odometer readings, fuel added and readings quantity)', (done) => {
			logged_app
			.post('/readings')
			.send({ travel_date: 'invalid_data', odo_readings: 'invalid_data', fuel_added: 'invalid_data', fuel_readings: 'invalid_data', destination: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_readings"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger');
				expect(res.text).to.containIgnoreSpaces('Please enter valid date');
				expect(res.text).to.containIgnoreSpaces('Please enter valid odometer readings');
				expect(res.text).to.containIgnoreSpaces('Please enter valid added fuel amount');
				expect(res.text).to.containIgnoreSpaces('Please enter valid fuel readings');
				done();
			});
		});

		it('Travel Info submit with negative values (odometer readings less than 1, fuel added and readings quantity less than 0)', (done) => {
			logged_app
			.post('/readings')
			.send({ travel_date: date_from_today(0), odo_readings: '0', fuel_added: '-1', fuel_readings: '-1', destination: 'Kathmandu' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_readings"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger');
				expect(res.text).to.containIgnoreSpaces('Please enter valid odometer readings');
				expect(res.text).to.containIgnoreSpaces('Added fuel quantity can not be negative');
				expect(res.text).to.containIgnoreSpaces('Fuel readings can not be negative');
				done();
			});
		});

		it('Travel Info submit with non complying to previous entry (date and odometer readings earlier than last entry and fuel_readings higher than sum of added fuel and last fuel readings)', (done) => {
			async.series([
				(async_callback) => {
					// insert settings for test
					insert_data(null, {doc: 'settings', data: {km_mile: 'km', max_fuel_capacity: 18}}, async_callback);
				},
				(async_callback) => {
					// insert readings for test
					insert_data(null, {doc: 'readings', data: {date: date_from_today(0), km_readings: 1000, fuel_added: 0, fuel_readings: 10, destination: 'Kathmandu'}}, async_callback);
				},
				(async_callback) => {
					logged_app
					.post('/readings')
					.send({ travel_date: date_from_today(-1), odo_readings: '999', fuel_added: '1', fuel_readings: '15', destination: 'Kathmandu' })
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.text).to.containIgnoreSpaces('id="form_readings"');
						expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger');
						expect(res.text).to.containIgnoreSpaces('Date can not be earlier than last entry');
						expect(res.text).to.containIgnoreSpaces('Odometer readings less than previous entry');
						expect(res.text).to.containIgnoreSpaces('Fuel readings higher than sum of added fuel and previous fuel readings');
						done();
					});
				}
			], done);
		});

		it('Travel Info submit with exceeding values (date exceeding today, odometer readings exceeding 6 digits, fuel added and readings exceeding maximum capacity and desination name logner than 50 characters)', (done) => {
			async.series([
				(async_callback) => {
					// insert settings for test
					insert_data(null, {doc: 'settings', data: {km_mile: 'km', max_fuel_capacity: 18}}, async_callback);
				},
				(async_callback) => {
					logged_app
					.post('/readings')
					.send({ travel_date: date_from_today(1), odo_readings: '1234567', fuel_added: '25', fuel_readings: '25', destination: '123456789112345678921234567893123456789412345678951' })
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.text).to.containIgnoreSpaces('id="form_readings"');
						expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger');
						expect(res.text).to.containIgnoreSpaces('Date exceeds today');
						expect(res.text).to.containIgnoreSpaces('Please enter valid odometer readings');
						expect(res.text).to.containIgnoreSpaces('Added fuel quantity exceeds the maximum fuel capacity');
						expect(res.text).to.containIgnoreSpaces('Fuel readings exceeds the maximum fuel capacity');
						expect(res.text).to.containIgnoreSpaces('Destination name too long');
						done();
					});
				}
			], done);
		});

		it('Travel Info submit with valid data', (done) => {
			logged_app
			.post('/readings')
			.send({ travel_date: date_from_today(0), odo_readings: '5555', fuel_added: '10', fuel_readings: '15', destination: 'Kathmandu' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				async.waterfall([
					(async_callback) => {async_callback(null, null, {doc: "readings", condition: {}, select: {}});},
						find_one
					], (err, readings_info) => {
						expect(res.text).to.not.containIgnoreSpaces('<div class="alert alert-danger');
						expect_object(null, {obj: readings_info, obj_items: [['km_readings', 5555], ['fuel_added', 10], ['fuel_readings', 15], ['destination', 'Kathmandu']]});
						expect(readings_info.date.toString()).to.containIgnoreSpaces(date_from_today(0));
						done();
					}
				);
			});
		});
	});
});
