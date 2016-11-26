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

describe('User Authentication Tests:', () => {
	// this block runs only once before everything else within this test
	before((done) => {
		async.series([
			(async_callback) => {
				hdb.connect(null, {}, async_callback);
			},
			(async_callback) => {
				hdb.db.createCollection('users', 
					(err, result) => {
						async_callback(err);
					}
				);
			},
			(async_callback) => {
				hdb.db.createCollection('pass_resets', 
					(err, result) => {
						async_callback(err);
					}
				);
			}
		], done);
	});

	// this will run before each describes within this test
	beforeEach((done) => {
		// console.log("BeforeEach: drop user collection");
		async.series([
			(async_callback) => {
				hdb.db.collection('users').remove(
					(err, result) => {
						async_callback(err);
					}
				);
			},
			(async_callback) => {
				hdb.db.collection('pass_resets').remove(
					(err, result) => {
						async_callback(err);
					}
				);
			}
		], done);
	});

	// Langind page response
	describe('Landing page response:', () => {
		it('Landing page redirecting to authentication page', (done) => {
			request(app)
			.get('/')
			.expect(302)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.headers).to.have.property('location');
				expect(res.headers.location).to.equal('/authen');
				done();
			});
		});
	});

	// Authentication page response
	describe('Authentication page response:', () => {
		it('Authentication page without any admin user', (done) => {
			request(app)
			.get('/authen')
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.not.containIgnoreSpaces('navbar-nav');
				expect(res.text).to.not.containIgnoreSpaces('navbar-right');
				expect(res.text).to.containIgnoreSpaces('<form id="form_signup"');
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_signin"');
				expect(res.text).to.containIgnoreSpaces('class="create_admin_checkbox"');
				done();
			});
		});

		it('Authentication page with admin user', (done) => {
			async.series([
				(async_callback) => {
					insert_data(null, {doc: 'users', data: {username:'abc@sample.com', user_email: 'abc@sample.com', password:'123456', user_role: 'admin'}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.get('/authen')
					.expect(200)
					.end((err, res) => {
						if (err) return async_callback(err);
						expect(res.text).to.not.containIgnoreSpaces('navbar-nav');
						expect(res.text).to.not.containIgnoreSpaces('navbar-right');
						expect(res.text).to.not.containIgnoreSpaces('<form id="form_signup"');
						expect(res.text).to.containIgnoreSpaces('<form id="form_signin"');
						async_callback(err);
					});
				}
			], done);
		});
	});

	// Sign up functionality
	describe('Sign up functionality:', () => {
		it('Sign up submit without any input', (done) => {
			request(app)
			.post('/authen/signup')
			.send({ signup_email: '', signup_password: '', signup_retype_password: '', user_role: '', first_admin: ''})
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.not.containIgnoreSpaces('navbar-nav');
				expect(res.text).to.not.containIgnoreSpaces('navbar-right');
				expect(res.text).to.containIgnoreSpaces('<form id="form_signup"');
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_signin"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Please enter email id.');
				expect(res.text).to.containIgnoreSpaces('Please enter password.');
				done();
			});
		});

		it('Sign up submit with invalid email and password shorter than 6 characters', (done) => {
			request(app)
			.post('/authen/signup')
			.send({ signup_email: 'invalid_email', signup_password: '12345', signup_retype_password: '', user_role: '', first_admin: ''})
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_signup"');
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_signin"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.not.containIgnoreSpaces('Please enter email id.');
				expect(res.text).to.not.containIgnoreSpaces('Please enter password.');
				expect(res.text).to.containIgnoreSpaces('Please enter valid email id.');
				expect(res.text).to.containIgnoreSpaces('Password should be at least 6 characters.');
				expect(res.text).to.containIgnoreSpaces('Retype password does not match.');
				done();
			});
		});

		it('Sign up submit with email longer than 100 characters and password mroe than 30 characters', (done) => {
			request(app)
			.post('/authen/signup')
			.send({ signup_email: 'valid_12345678911234567892123456789312345678941234567895123456789612345678971234567898123456789912345678901@email.com', signup_password: '1234567891123456789212345678931', signup_retype_password: '', user_role: '', first_admin: ''})
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_signup"');
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_signin"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Email id too long');
				expect(res.text).to.containIgnoreSpaces('Password too long');
				done();
			});
		});

		it('Sign up submit with duplicate email', (done) => {
			async.series([
				(async_callback) => {
					insert_data(null, {doc: 'users', data: {username:'abc@sample.com', user_email: 'abc@sample.com', password:'123456', user_role: 'admin'}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.post('/authen/signup')
					.send({ signup_email: 'abc@sample.com', signup_password: '123456', signup_retype_password: '123456', user_role: '', first_admin: ''})
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.text).to.containIgnoreSpaces('<form id="form_signup"');
						expect(res.text).to.not.containIgnoreSpaces('<form id="form_signin"');
						expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
						expect(res.text).to.not.containIgnoreSpaces('Please enter email id.');
						expect(res.text).to.not.containIgnoreSpaces('Please enter password.');
						expect(res.text).to.not.containIgnoreSpaces('Please enter valid email id.');
						expect(res.text).to.not.containIgnoreSpaces('Password should be at least 6 characters.');
						expect(res.text).to.not.containIgnoreSpaces('Retype password does not match.');
						expect(res.text).to.containIgnoreSpaces('Email id already exists.');
						done();
					});
				}
			], done);
		});

		it('Sign up submit with non matching retype password', (done) => {
			request(app)
			.post('/authen/signup')
			.send({ signup_email: 'valid@email.com', signup_password: '123456', signup_retype_password: '1234567', user_role: '', first_admin: ''})
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_signup"');
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_signin"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Retype password does not match');
				done();
			});
		});

		it('Sign up submit with valid data', (done) => {
			request(app)
			.post('/authen/signup')
			.send({ signup_email: 'abc@sample.com', signup_password: '123456', signup_retype_password: '123456', user_role: 'admin', first_admin: ''})
			.expect(302)
			.end((err, res) => {
				if (err) return done(err);
				async.waterfall([
					(async_callback) => {async_callback(null, null, {doc: "users", condition: {}, select: {}});},
						find_one
					], (err, user_info) => {
						expect(res.headers).to.have.property('location');
						expect(res.headers.location).to.equal('/');
						expect_object(null, {obj: user_info, obj_items: [['user_email', 'abc@sample.com'], 'password', ['user_role', 'admin']]});
						done();
					}
				);
			});
		});
	});

	// Sign in functionality
	describe('Sign in functionality:', () => {
		it('Sign in submit without any input', (done) => {
			request(app)
			.post('/authen/signin')
			.send({ signin_email: '', signin_password: ''})
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.not.containIgnoreSpaces('navbar-nav');
				expect(res.text).to.not.containIgnoreSpaces('navbar-right');
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_signup"');
				expect(res.text).to.containIgnoreSpaces('<form id="form_signin"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Please enter email id.');
				expect(res.text).to.containIgnoreSpaces('Please enter password.');
				done();
			});
		});

		it('Sign in submit with invalid email and password shorter than 6 characters', (done) => {
			request(app)
			.post('/authen/signin')
			.send({ signin_email: 'invalid_email', signin_password: '12345'})
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_signup"');
				expect(res.text).to.containIgnoreSpaces('<form id="form_signin"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.not.containIgnoreSpaces('Please enter email id.');
				expect(res.text).to.not.containIgnoreSpaces('Please enter password.');
				expect(res.text).to.containIgnoreSpaces('Please enter valid email id.');
				expect(res.text).to.containIgnoreSpaces('Password should be at least 6 characters.');
				done();
			});
		});

		it('Sign in submit with email longer than 100 characters and password longer than 30 characters', (done) => {
			request(app)
			.post('/authen/signin')
			.send({ signin_email: 'valid_12345678911234567892123456789312345678941234567895123456789612345678971234567898123456789912345678901@email.com', signin_password: '1234567891123456789212345678931'})
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_signup"');
				expect(res.text).to.containIgnoreSpaces('<form id="form_signin"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Email id too long');
				expect(res.text).to.containIgnoreSpaces('Password too long');
				done();
			});
		});

		it('Sign in submit with unregistered email', (done) => {
			request(app)
			.post('/authen/signin')
			.send({ signin_email: 'valid@email.com', signin_password: '123456'})
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_signup"');
				expect(res.text).to.containIgnoreSpaces('<form id="form_signin"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.not.containIgnoreSpaces('Please enter email id.');
				expect(res.text).to.not.containIgnoreSpaces('Please enter valid email id.');
				expect(res.text).to.not.containIgnoreSpaces('Please enter password.');
				expect(res.text).to.not.containIgnoreSpaces('Password should be at least 6 characters.');
				expect(res.text).to.containIgnoreSpaces('User name / Email not found.');
				done();
			});
		});

		it('Sign in submit with correct email but incorrect password', (done) => {
			async.series([
				(async_callback) => {
					insert_data(null, {doc: 'users', data: {username:'abc@sample.com', user_email: 'abc@sample.com', password:'123456', user_role: 'admin'}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.post('/authen/signin')
					.send({ signin_email: 'abc@sample.com', signin_password: '1234567'})
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.text).to.not.containIgnoreSpaces('<form id="form_signup"');
						expect(res.text).to.containIgnoreSpaces('<form id="form_signin"');
						expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
						expect(res.text).to.not.containIgnoreSpaces('Please enter email id.');
						expect(res.text).to.not.containIgnoreSpaces('Please enter valid email id.');
						expect(res.text).to.not.containIgnoreSpaces('Please enter password.');
						expect(res.text).to.not.containIgnoreSpaces('Password should be at least 6 characters.');
						expect(res.text).to.not.containIgnoreSpaces('User name / Email not found.');
						expect(res.text).to.containIgnoreSpaces('Password does not match.');
						done();
					});
				}
			], done);
		});

		it('Sign in submit with correct email and password', (done) => {
			async.series([
				(async_callback) => {
					muser.create_new_user(null, {doc_data: {user_email: 'abc@sample.com', password: '123456', user_role: 'admin'}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.post('/authen/signin')
					.send({ signin_email: 'abc@sample.com', signin_password: '123456'})
					.expect(302)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.headers).to.have.property('location');
						expect(res.headers.location).to.equal('/');
						done();
					});
				}
			], done);
		});
	});

	// Forgot password functionality
	describe('Forgot password functionality:', () => {
		it('Forgot password response', (done) => {
			request(app)
			.get('/authen/forgot_password')
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.not.containIgnoreSpaces('navbar-nav');
				expect(res.text).to.not.containIgnoreSpaces('navbar-right');
				expect(res.text).to.containIgnoreSpaces('<form id="form_forgot_password"');
				done();
			});
		});

		it('Forgot password submit without input', (done) => {
			request(app)
			.post('/authen/forgot_password')
			.send({ forgot_email: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_forgot_password"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Please enter email id.');
				done();
			});
		});

		it('Forgot password submit with invalid email', (done) => {
			request(app)
			.post('/authen/forgot_password')
			.send({ forgot_email: 'invalid_email' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_forgot_password"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Please enter valid email id.');
				done();
			});
		});

		it('Forgot password submit with email longer than 100 characters', (done) => {
			request(app)
			.post('/authen/forgot_password')
			.send({ forgot_email: 'valid_12345678911234567892123456789312345678941234567895123456789612345678971234567898123456789912345678901@email.com' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_forgot_password"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Email id too long');
				done();
			});
		});

		it('Forgot password submit with unregistered email', (done) => {
			request(app)
			.post('/authen/forgot_password')
			.send({ forgot_email: 'invalid@email.com' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_forgot_password"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Email id not found.');
				done();
			});
		});

		it('Forgot password submit with correct email', (done) => {
			async.series([
				(async_callback) => {
					insert_data(null, {doc: 'users', data: {username:'abc@sample.com', user_email: 'abc@sample.com', password:'123456', user_role: 'admin'}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.post('/authen/forgot_password')
					.send({ forgot_email: 'abc@sample.com' })
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						async.waterfall([
							(async_callback) => {async_callback(null, null, {doc: "pass_resets", condition: {}, select: {}});},
								find_one
							], (err, pass_reset_info) => {
								expect(res.text).to.not.containIgnoreSpaces('<form id="form_forgot_password"');
								expect(res.text).to.containIgnoreSpaces('Please check your email and follow the steps to reset the password.');
								expect_object(null, {obj: pass_reset_info, obj_items: [['user_email', 'abc@sample.com'], 'reset_phrase', ['status', 1]]});
								done();
							}
						);						
					});
				}
			], done);
		});
	});

	// Reset password functionality
	describe('Reset password functionality:', () => {
		it('Reset password with incorrect reset link', (done) => {
			request(app)
			.get('/authen/reset_password/:reset_phrase')
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.not.containIgnoreSpaces('navbar-nav');
				expect(res.text).to.not.containIgnoreSpaces('navbar-right');
				expect(res.text).to.containIgnoreSpaces('The reset link is not correct.');
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_reset_password"');
				done();
			});
		});

		it('Reset password with expired reset link', (done) => {
			async.series([
				(async_callback) => {
					// insert test pass_resets record with createdAt time stamp of 24 hours earlier time
					insert_data(null, {doc: 'pass_resets', data: {user_email: 'abc@sample.com', reset_phrase:'reset_phrase', createdAt: new Date(new Date()-1000 * 24 * 60 * 60)}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.get('/authen/reset_password/reset_phrase')
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						async.waterfall([
							(async_callback) => {async_callback(null, null, {doc: "pass_resets", condition: {}, select: {}});},
								find_one
							], (err, pass_resets_info) => {
								expect(res.text).to.containIgnoreSpaces('The reset link has expired');
								expect(res.text).to.not.containIgnoreSpaces('<form id="form_reset_password"');
								expect_object(null, {obj: pass_resets_info, obj_items: [['user_email', 'abc@sample.com'], ['reset_phrase', 'reset_phrase'], ['status', 3]]});
								done();
							}
						);
					});
				}
			], done);
		});

		// status: 2 - used, 3 - expired
		it('Reset password with status 2', (done) => {
			async.series([
				(async_callback) => {
					insert_data(null, {doc: 'pass_resets', data: {user_email: 'abc@sample.com', reset_phrase:'reset_phrase', status: 2}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.get('/authen/reset_password/reset_phrase')
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.text).to.containIgnoreSpaces('The reset link has already been used to reset the password once');
						expect(res.text).to.not.containIgnoreSpaces('<form id="form_reset_password"');
						done();
					});
				}
			], done);
		});

		it('Reset password with status 3', (done) => {
			async.series([
				(async_callback) => {
					insert_data(null, {doc: 'pass_resets', data: {user_email: 'abc@sample.com', reset_phrase:'reset_phrase', status: 3}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.get('/authen/reset_password/reset_phrase')
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.text).to.containIgnoreSpaces('The reset link has expired.');
						expect(res.text).to.not.containIgnoreSpaces('<form id="form_reset_password"');
						done();
					});
				}
			], done);
		});

		it('Reset password submit without any input', (done) => {
			request(app)
			.put('/authen/reset_password')
			.send({ new_password: '', retype_password: '', reset_link: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_reset_password"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Please enter password.');
				done();
			});
		});

		it('Reset password submit with password shorter than 6 characters', (done) => {
			request(app)
			.put('/authen/reset_password')
			.send({ new_password: '12345', retype_password: '', reset_link: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_reset_password"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Password should be at least 6 characters');
				done();
			});
		});

		it('Reset password submit with password longer than 30 characters', (done) => {
			request(app)
			.put('/authen/reset_password')
			.send({ new_password: '1234567891123456789212345678931', retype_password: '', reset_link: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_reset_password"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Password too long');
				done();
			});
		});

		it('Reset password submit with not matching retype password', (done) => {
			request(app)
			.put('/authen/reset_password')
			.send({ new_password: '123456', retype_password: '1234567', reset_link: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_reset_password"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Retype password does not match');
				done();
			});
		});

		it('Reset password submit with tampered invalid reset link', (done) => {
			request(app)
			.put('/authen/reset_password')
			.send({ new_password: '123456', retype_password: '123456', reset_link: 'invalid_reset_link' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('The reset link is not correct.');
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_reset_password"');
				done();
			});
		});

		it('Reset password submit with tampered expired reset link', (done) => {
			async.series([
				(async_callback) => {
					// insert test pass_resets record with createdAt time stamp of 24 hours earlier time
					insert_data(null, {doc: 'pass_resets', data: {user_email: 'abc@sample.com', reset_phrase:'reset_phrase', createdAt: new Date(new Date()-1000 * 24 * 60 * 60), status: 1}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.put('/authen/reset_password')
					.send({ new_password: '123456', retype_password: '123456', reset_link: 'reset_phrase' })
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						async.waterfall([
							(async_callback) => {async_callback(null, null, {doc: "pass_resets", condition: {}, select: {}});},
								find_one
							], (err, pass_resets_info) => {
								expect(res.text).to.containIgnoreSpaces('The reset link has expired');
								expect(res.text).to.not.containIgnoreSpaces('<form id="form_reset_password"');
								expect_object(null, {obj: pass_resets_info, obj_items: [['user_email', 'abc@sample.com'], ['reset_phrase', 'reset_phrase'], ['status', 3]]});
								done();
							}
						);
					});
				}
			], done);
		});
		
		it('Reset password submit with tampered reset link having status 2', (done) => {
			async.series([
				(async_callback) => {
					insert_data(null, {doc: 'pass_resets', data: {user_email: 'abc@sample.com', reset_phrase:'reset_phrase', status: 2}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.put('/authen/reset_password')
					.send({ new_password: '123456', retype_password: '123456', reset_link: 'reset_phrase' })
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.text).to.containIgnoreSpaces('The reset link has already been used to reset the password once');
						expect(res.text).to.not.containIgnoreSpaces('<form id="form_reset_password"');
						done();
					});
				}
			], done);
		});

		it('Reset password submit with tampered reset link having status 3', (done) => {
			async.series([
				(async_callback) => {
					insert_data(null, {doc: 'pass_resets', data: {user_email: 'abc@sample.com', reset_phrase:'reset_phrase', status: 3}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.put('/authen/reset_password')
					.send({ new_password: '123456', retype_password: '123456', reset_link: 'reset_phrase' })
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.text).to.containIgnoreSpaces('The reset link has expired');
						expect(res.text).to.not.containIgnoreSpaces('<form id="form_reset_password"');
						done();
					});
				}
			], done);
		});

		it('Reset password submit with valid password and retype password', (done) => {
			async.series([
				(async_callback) => {
					// insert user for test
					insert_data(null, {doc: 'users', data: {username:'abc@sample.com', user_email: 'abc@sample.com', password:'345678', user_role: 'admin'}}, async_callback);
				},
				(async_callback) => {
					// insert pass_reset for test
					insert_data(null, {doc: 'pass_resets', data: {user_email: 'abc@sample.com', reset_phrase:'reset_phrase', createdAt: new Date()}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.put('/authen/reset_password')
					.send({ new_password: '123456', retype_password: '123456', reset_link: 'reset_phrase' })
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						async.waterfall([
							(async_callback) => {async_callback(null, null, {doc: "users", condition: {}, select: {}});},
								find_one,
								(user_info, async_callback) => {
									expect(res.text).to.not.containIgnoreSpaces('<form id="form_reset_password"');
									expect(res.text).to.containIgnoreSpaces('Password has been reset.');
									expect_object(null, {obj: user_info, obj_items: [['user_email', 'abc@sample.com']]});
									muser.compare_password(null, {password: '123456', hash: user_info.password}, async_callback);
								}
							], (err, is_match) => {
								expect(is_match).to.equal(true);
								done();
							}
						);
					});
				}
			], done);
		});
	});

	// Change password functionality
	describe('Change password functionality:', () => {
		const logged_app = request.agent(app) ;

		before((done) => {
			async.series([
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

		it('Change password response', (done) => {
			request(app)
			.get('/authen/change_password')
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('navbar-nav');
				expect(res.text).to.containIgnoreSpaces('navbar-right');
				expect(res.text).to.containIgnoreSpaces('id="form_change_password"');
				done();
			});
		});

		it('Change password submit without any input', (done) => {
			request(app)
			.put('/authen/change_password')
			.send({ old_password: '', new_password: '', retype_password: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_change_password"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Please enter password');
				done();
			});
		});

		it('Change password submit with password shorter than 6 characters', (done) => {
			request(app)
			.put('/authen/change_password')
			.send({ old_password: '12345', new_password: '12345', retype_password: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_change_password"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Password should be at least 6 characters');
				done();
			});
		});

		it('Change password submit with password longer than 30 characters', (done) => {
			request(app)
			.put('/authen/change_password')
			.send({ old_password: '1234567891123456789212345678931', new_password: '1234567891123456789212345678931', retype_password: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_change_password"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Password too long');
				done();
			});
		});

		it('Change password submit with non matching retype password', (done) => {
			request(app)
			.put('/authen/change_password')
			.send({ old_password: '123456', new_password: '123456', retype_password: '1234567' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('id="form_change_password"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Retype password does not match');
				done();
			});
		});

		it('Change password submit with incorrect old password', (done) => {
			async.series([
				(async_callback) => {
					// insert user for test
					insert_data(null, {doc: 'users', data: {username:'abc@sample.com', user_email: 'abc@sample.com', password:'123456', user_role: 'admin'}}, async_callback);
				},
				(async_callback) => {
					logged_app
					.put('/authen/change_password')
					.send({ old_password: '1234567', new_password: '234567', retype_password: '234567' })
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.text).to.containIgnoreSpaces('id="form_change_password"');
						expect(res.text).to.not.containIgnoreSpaces('Password has been successfully changed');
						expect(res.text).to.containIgnoreSpaces('Old password does not match');
						done();
					});
				}
			], done);
		});

		it('Change password submit with correct passwords', (done) => {
			async.series([
				(async_callback) => {
					// insert user for test
					muser.create_new_user(null, {doc_data: {user_email: 'abc@sample.com', password: '123456', user_role: 'admin'}}, async_callback);
				},
				(async_callback) => {
					logged_app
					.put('/authen/change_password')
					.send({ old_password: '123456', new_password: '234567', retype_password: '234567' })
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						async.waterfall([
							(async_callback) => {async_callback(null, null, {doc: "users", condition: {}, select: {}});},
								find_one,
								(user_info, async_callback) => {
									expect(res.text).to.not.containIgnoreSpaces('id="form_change_password"');
									expect(res.text).to.containIgnoreSpaces('Password has been successfully changed');
									expect_object(null, {obj: user_info, obj_items: [['user_email', 'abc@sample.com']]});
									muser.compare_password(null, {password: '234567', hash: user_info.password}, async_callback);
								}
							], (err, is_match) => {
								expect(is_match).to.equal(true);
								done();
							}
						);
					});
				}
			], done);
		});
	});
});
