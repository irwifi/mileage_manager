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

// Test for Mileage Manager
console.log("Test cases running");

const insert_data = (err, params, callback) => {
	hdb.db.collection(params.doc).insert(params.data, callback);
};

describe('Mileage Manager Test:', () => {
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

		// it('Landing page after authentication', (done) => {
		// 	request(app)
		// 	.get('/')
		// 	.expect(200)
		// 	.end((err, res) => {
		// 		if (err) return done(err);
		// 		// expect(res.text).to.containIgnoreSpaces('signout');
		// 		done();
		// 	});
		// });
	});

	// Authentication page response
	describe('Authentication page response:', () => {
		it('Authentication page without any admin user', (done) => {
			request(app)
			.get('/authen')
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
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
		it('Sign up without any input', (done) => {
			request(app)
			.post('/authen/signup')
			.send({ signup_email: '', signup_password: '', signup_retype_password: '', user_role: '', first_admin: ''})
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_signup"');
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_signin"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Please enter email id.');
				expect(res.text).to.containIgnoreSpaces('Please enter password.');
				done();
			});
		});

		it('Sign up without any input', (done) => {
			request(app)
			.post('/authen/signup')
			.send({ signup_email: '', signup_password: '', signup_retype_password: '', user_role: '', first_admin: ''})
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_signup"');
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_signin"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Please enter email id.');
				expect(res.text).to.containIgnoreSpaces('Please enter password.');
				done();
			});
		});

		it('Sign up with invalid email and password less than 6 characters', (done) => {
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

		it('Sign up with duplicate email', (done) => {
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

		it('Sign up with valid data', (done) => {
			request(app)
			.post('/authen/signup')
			.send({ signup_email: 'abc@sample.com', signup_password: '123456', signup_retype_password: '123456', user_role: 'admin', first_admin: ''})
			.expect(302)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.headers).to.have.property('location');
				done();
			});
		});
	});

	// Sign in functionality
	describe('Sign in functionality:', () => {
		it('Sign in without any input', (done) => {
			request(app)
			.post('/authen/signin')
			.send({ signin_email: '', signin_password: ''})
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_signup"');
				expect(res.text).to.containIgnoreSpaces('<form id="form_signin"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Please enter email id.');
				expect(res.text).to.containIgnoreSpaces('Please enter password.');
				done();
			});
		});

		it('Sign in with invalid email and password less than 6 characters', (done) => {
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

		it('Sign in with unregistered email', (done) => {
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

		it('Sign in with correct email but incorrect password', (done) => {
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

		it('Sign in with correct email and password', (done) => {
			async.series([
				(async_callback) => {
					muser.create_new_user(null, {form_data: {user_email: 'abc@sample.com', password: '123456', user_role: 'admin'}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.post('/authen/signin')
					.send({ signin_email: 'abc@sample.com', signin_password: '123456'})
					.expect(302)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.headers).to.have.property('location');
						// expect(res.headers.location).to.equal('/');
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
				expect(res.text).to.containIgnoreSpaces('<form id="form_forgot_password"');
				done();
			});
		});

		it('Forgot password without input', (done) => {
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

		it('Forgot password with invalid email', (done) => {
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

		it('Forgot password with incorrect email', (done) => {
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

		it('Forgot password with correct email', (done) => {
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
						expect(res.text).to.not.containIgnoreSpaces('<form id="form_forgot_password"');
						expect(res.text).to.containIgnoreSpaces('Please check your email and follow the steps to reset the password.');
						done();
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
				expect(res.text).to.containIgnoreSpaces('The reset link is not correct.');
				expect(res.text).to.not.containIgnoreSpaces('<form id="form_reset_password"');
				done();
			});
		});

		it('Reset password with expired reset link', (done) => {
			async.series([
				(async_callback) => {
					insert_data(null, {doc: 'pass_resets', data: {user_email: 'abc@sample.com', reset_phrase:'reset_phrase', createdAt: new Date(new Date()-1000 * 24 * 60 * 60)}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.get('/authen/reset_password/reset_phrase')
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

		it('Reset password with valid reset link', (done) => {
			async.series([
				(async_callback) => {
					insert_data(null, {doc: 'pass_resets', data: {user_email: 'abc@sample.com', reset_phrase:'reset_phrase', createdAt: new Date(new Date())}}, async_callback);
				},
				(async_callback) => {
					request(app)
					.get('/authen/reset_password/reset_phrase')
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.text).to.containIgnoreSpaces('<form id="form_reset_password"');
						done();
					});
				}
			], done);
		});

		it('Reset password without any input', (done) => {
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

		it('Reset password with password less than 6 characters', (done) => {
			request(app)
			.put('/authen/reset_password')
			.send({ new_password: '12345', retype_password: '', reset_link: '' })
			.expect(200)
			.end((err, res) => {
				if (err) return done(err);
				expect(res.text).to.containIgnoreSpaces('<form id="form_reset_password"');
				expect(res.text).to.containIgnoreSpaces('<div class="alert alert-danger">');
				expect(res.text).to.containIgnoreSpaces('Password should be at least 6 characters.');
				expect(res.text).to.containIgnoreSpaces('Retype password does not match.');
				done();
			});
		});

		it('Reset password with valid password and retype password', (done) => {
			async.series([
				(async_callback) => {
					insert_data(null, {doc: 'users', data: {username:'abc@sample.com', user_email: 'abc@sample.com', password:'123456', user_role: 'admin'}}, async_callback);
				},				
				(async_callback) => {
					insert_data(null, {doc: 'pass_resets', data: {user_email: 'abc@sample.com', reset_phrase:'reset_phrase'}}, async_callback);
				},
				(async_callback) => {			
					request(app)
					.put('/authen/reset_password')
					.send({ new_password: '123456', retype_password: '123456', reset_link: 'reset_phrase' })
					.expect(200)
					.end((err, res) => {
						if (err) return done(err);
						expect(res.text).to.not.containIgnoreSpaces('<form id="form_reset_password"');
						expect(res.text).to.containIgnoreSpaces('Password has been reset.');
						done();
					});
				}
			], done);
		});
	});
});
